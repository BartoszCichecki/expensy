using System.Data;
using System.Text.RegularExpressions;
using Dapper;
using Expensy.Data;
using Expensy.Web;

namespace Expensy.Endpoints;

/// <summary>
/// Categories are shared by all users and managed by the admin. Removing one is two steps: archiving hides it
/// from the picker while old expenses keep showing it; an archived one can then be restored or deleted for good.
/// One category can be the default for new expenses.
/// </summary>
public static partial class CategoryEndpoints
{
    private const int MaxNameLength = 40;

    public static void MapCategoryEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api/categories");
        // Categories are shared by everyone, so only the admin can change them; everyone can read them.
        var manage = api.MapGroup("/").RequireAdmin();

        // Archived categories are included, so old expenses can still show theirs.
        api.MapGet("/", (Database db) =>
        {
            using var c = db.Open();
            return c.Query<Category>($"{Select} ORDER BY archived, sort_order, id");
        });

        manage.MapPost("/", (CategoryInput input, Database db) =>
        {
            if (Validate(input) is { } error) return error;
            using var c = db.Open();
            var id = c.ExecuteScalar<long>(
                $"""
                INSERT INTO categories (name, icon, color, sort_order)
                VALUES (@Name, @Icon, @Color, {NextSortOrder})
                RETURNING id
                """, Clean(input));
            return Results.Ok(Get(c, id));
        });

        manage.MapPut("/{id:long}", (long id, CategoryInput input, Database db) =>
        {
            if (Validate(input) is { } error) return error;
            using var c = db.Open();
            var clean = Clean(input);
            // Renaming a built-in category drops its translation key, so the new name is shown as typed.
            var updated = c.Execute(
                """
                UPDATE categories
                SET key = CASE WHEN name = @Name THEN key ELSE NULL END, name = @Name, icon = @Icon, color = @Color
                WHERE id = @id
                """, new { clean.Name, clean.Icon, clean.Color, id });
            return updated == 0 ? Results.NotFound() : Results.Ok(Get(c, id));
        });

        manage.MapPost("/{id:long}/archive", (long id, Database db) =>
        {
            using var c = db.Open();
            c.Execute("UPDATE categories SET archived = 1 WHERE id = @id", new { id });
            // An archived category can't be picked any more, so it can't stay the default either.
            if (c.GetSetting(Settings.DefaultCategory) == id.ToString()) c.RemoveSetting(Settings.DefaultCategory);
            return Get(c, id) is { } category ? Results.Ok(category) : Results.NotFound();
        });

        manage.MapPost("/{id:long}/restore", (long id, Database db) =>
        {
            using var c = db.Open();
            c.Execute($"UPDATE categories SET archived = 0, sort_order = {NextSortOrder} WHERE id = @id", new { id });
            return Get(c, id) is { } category ? Results.Ok(category) : Results.NotFound();
        });

        // Only archived categories can be deleted. Their expenses lose them; an expense left without any
        // category is shown as "Other".
        manage.MapDelete("/{id:long}", (long id, Database db) =>
        {
            using var c = db.Open();
            if (Get(c, id) is not { } category) return Results.NotFound();
            if (!category.Archived)
                return ApiErrors.BadRequest("category_not_archived", "Archive the category before deleting it.");
            using var tx = c.BeginTransaction();
            c.Execute("DELETE FROM expense_categories WHERE category_id = @id", new { id }, tx);
            c.Execute("DELETE FROM categories WHERE id = @id", new { id }, tx);
            tx.Commit();
            return Results.NoContent();
        });

        manage.MapPost("/{id:long}/default", (long id, Database db) =>
        {
            using var c = db.Open();
            if (Get(c, id) is not { Archived: false }) return Results.NotFound();
            c.SetSetting(Settings.DefaultCategory, id.ToString());
            return Results.NoContent();
        });

        manage.MapDelete("/default", (Database db) =>
        {
            using var c = db.Open();
            c.RemoveSetting(Settings.DefaultCategory);
            return Results.NoContent();
        });

        // Body: all active category ids in the new order.
        manage.MapPut("/order", (ReorderInput input, Database db) =>
        {
            using var c = db.Open();
            using var tx = c.BeginTransaction();
            for (var i = 0; i < input.Ids.Length; i++)
                c.Execute("UPDATE categories SET sort_order = @order WHERE id = @id", new { order = i + 1, id = input.Ids[i] }, tx);
            tx.Commit();
            return Results.NoContent();
        });
    }

    /// <summary>Categories with an <c>is_default</c> flag computed from the settings table.</summary>
    private const string Select =
        $"""
        SELECT *, id = (SELECT CAST(value AS INTEGER) FROM settings WHERE key = '{Settings.DefaultCategory}') AS is_default
        FROM categories
        """;

    /// <summary>Puts a new or restored category at the end of the list.</summary>
    private const string NextSortOrder = "(SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories)";

    private static Category? Get(IDbConnection c, long id) =>
        c.QuerySingleOrDefault<Category>($"{Select} WHERE id = @id", new { id });

    private static CategoryInput Clean(CategoryInput i) =>
        new(i.Name.Trim(), string.IsNullOrWhiteSpace(i.Icon) ? "📦" : i.Icon.Trim(), i.Color.ToLowerInvariant());

    private static IResult? Validate(CategoryInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > MaxNameLength)
            return ApiErrors.BadRequest("category_name_invalid", $"Category name must be 1-{MaxNameLength} characters.");
        if (input.Icon is { Length: > 16 })
            return ApiErrors.BadRequest("category_icon_invalid", "The icon should be a single emoji.");
        if (input.Color is null || !HexColor().IsMatch(input.Color))
            return ApiErrors.BadRequest("category_color_invalid", "Invalid colour.");
        return null;
    }

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex HexColor();
}
