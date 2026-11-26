using System.Data;
using Dapper;
using Expensy.Data;
using Expensy.Services;
using Expensy.Web;
using Microsoft.AspNetCore.Mvc;

namespace Expensy.Endpoints;

/// <summary>
/// The logged-in user's expenses and their photos. Every query is scoped to the user: other users' expenses
/// look exactly like missing ones (404), so their existence isn't revealed.
/// </summary>
public static class ExpenseEndpoints
{
    private const long MaxAmountCents = 999_999_999_99; // 9 digits before the decimal point, same as the app
    private const int MaxNoteLength = 500;
    private const int MaxPlaceLength = 200;
    private const int MaxCategories = 10;

    /// <summary>Expenses with their category ids ("3,7") — every query that returns expenses starts with this.</summary>
    private const string SelectExpense =
        """
        SELECT e.*,
               (SELECT group_concat(ec.category_id) FROM expense_categories ec WHERE ec.expense_id = e.id) AS category_list
        FROM expenses e
        """;

    public static void MapExpenseEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api/expenses");

        // ?settlementId=5 → one archived settlement; ?all=true → everything; no parameter → the current list.
        api.MapGet("/", (long? settlementId, bool? all, Database db, HttpContext ctx) =>
        {
            using var c = db.Open();
            return c.Query<Expense>(
                $"""
                {SelectExpense}
                WHERE e.user_id = @userId
                  AND (@all = 1
                       OR (@settlementId IS NULL AND e.settlement_id IS NULL)
                       OR e.settlement_id = @settlementId)
                ORDER BY e.spent_at DESC, e.id DESC
                """, new { userId = ctx.CurrentUser().Id, settlementId, all = all == true ? 1 : 0 });
        });

        // ?lang=pl|en → language of the place name, if the server has to look it up after saving.
        api.MapPost("/", (ExpenseInput input, string? lang, Database db, PlaceFiller places, HttpContext ctx) =>
        {
            if (Validate(input, db) is { } error) return error;

            using var c = db.Open();
            using var tx = c.BeginTransaction();
            var id = c.ExecuteScalar<long>(
                """
                INSERT INTO expenses (user_id, amount_cents, note, spent_at, created_at, latitude, longitude, accuracy, place)
                VALUES (@UserId, @AmountCents, @Note, @SpentAt, @CreatedAt, @Latitude, @Longitude, @Accuracy, @Place)
                RETURNING id
                """, ExpenseRow.From(input) with { UserId = ctx.CurrentUser().Id, CreatedAt = Time.Now() }, tx);
            SetCategories(c, tx, id, input.CategoryIds);
            tx.Commit();

            var saved = Get(c, id, ctx)!;
            places.FillInBackground(saved, lang);
            return Results.Ok(saved);
        });

        api.MapPut("/{id:long}", (long id, ExpenseInput input, string? lang, Database db, PlaceFiller places, HttpContext ctx) =>
        {
            if (Validate(input, db) is { } error) return error;

            using var c = db.Open();
            if (Get(c, id, ctx) is null) return Results.NotFound();
            using var tx = c.BeginTransaction();
            c.Execute(
                """
                UPDATE expenses
                SET amount_cents = @AmountCents, note = @Note, spent_at = @SpentAt,
                    latitude = @Latitude, longitude = @Longitude, accuracy = @Accuracy, place = @Place
                WHERE id = @Id
                """, ExpenseRow.From(input) with { Id = id }, tx);
            SetCategories(c, tx, id, input.CategoryIds);
            tx.Commit();

            var saved = Get(c, id, ctx)!;
            places.FillInBackground(saved, lang);
            return Results.Ok(saved);
        });

        api.MapDelete("/{id:long}", (long id, Database db, PhotoStore photos, HttpContext ctx) =>
        {
            using var c = db.Open();
            if (Get(c, id, ctx) is not { } expense) return Results.NotFound();
            c.Execute("DELETE FROM expenses WHERE id = @id", new { id }); // its category links go with it (ON DELETE CASCADE)
            photos.Delete(expense.Photo);
            return Results.NoContent();
        });

        // Fills in a missing place name right away (the app calls this when opening an older expense).
        api.MapPost("/{id:long}/place", async (long id, string? lang, Database db, PlaceFiller places, HttpContext ctx, CancellationToken ct) =>
        {
            using var c = db.Open();
            if (Get(c, id, ctx) is not { } expense) return Results.NotFound();
            await places.FillNowAsync(expense, lang, ct);
            return Results.Ok(Get(c, id, ctx));
        });

        // ----- photos -----

        api.MapPost("/{id:long}/photo", async (long id, IFormFile photo, Database db, PhotoStore photos, HttpContext ctx, CancellationToken ct) =>
        {
            using var c = db.Open();
            if (Get(c, id, ctx) is not { } expense) return Results.NotFound();

            var name = await photos.SaveAsync(photo, ct);
            if (name is null)
                return ApiErrors.BadRequest("photo_invalid", "Unsupported photo (JPEG, PNG, WebP, HEIC or GIF, max 10 MB).");

            c.Execute("UPDATE expenses SET photo = @name WHERE id = @id", new { name, id });
            photos.Delete(expense.Photo); // the replaced one
            return Results.Ok(Get(c, id, ctx));
        })
        .DisableAntiforgery() // CSRF is handled for the whole API by Security.UseApiGuard
        .WithMetadata(new RequestSizeLimitAttribute(PhotoStore.MaxBytes + 1024 * 1024));

        api.MapDelete("/{id:long}/photo", (long id, Database db, PhotoStore photos, HttpContext ctx) =>
        {
            using var c = db.Open();
            if (Get(c, id, ctx) is not { } expense) return Results.NotFound();
            c.Execute("UPDATE expenses SET photo = NULL WHERE id = @id", new { id });
            photos.Delete(expense.Photo);
            return Results.Ok(Get(c, id, ctx));
        });

        // Served only to the owner of the expense the photo belongs to.
        app.MapGet("/api/photos/{name}", (string name, PhotoStore photos, Database db, HttpContext ctx) =>
        {
            using (var c = db.Open())
            {
                var isOwn = c.ExecuteScalar<bool>(
                    "SELECT EXISTS (SELECT 1 FROM expenses WHERE photo = @name AND user_id = @userId)",
                    new { name, userId = ctx.CurrentUser().Id });
                if (!isOwn) return Results.NotFound();
            }
            if (photos.Find(name) is not { } file) return Results.NotFound();

            // File names are unique and never reused, so the browser can cache them forever.
            ctx.Response.Headers.CacheControl = "private, max-age=31536000, immutable";
            return Results.File(file.Path, file.ContentType);
        });

        // Place name for coordinates, shown in the form while adding an expense.
        app.MapGet("/api/geocode", async (double lat, double lon, string? lang, Geocoder geocoder, CancellationToken ct) =>
            Results.Ok(new { place = await geocoder.ReverseAsync(lat, lon, lang, ct) }));
    }

    /// <summary>The expense if it belongs to the logged-in user, otherwise null.</summary>
    private static Expense? Get(IDbConnection c, long id, HttpContext ctx) =>
        c.QuerySingleOrDefault<Expense>($"{SelectExpense} WHERE e.id = @id AND e.user_id = @userId",
            new { id, userId = ctx.CurrentUser().Id });

    /// <summary>Replaces the expense's categories.</summary>
    private static void SetCategories(IDbConnection c, IDbTransaction tx, long expenseId, long[]? categoryIds)
    {
        c.Execute("DELETE FROM expense_categories WHERE expense_id = @expenseId", new { expenseId }, tx);
        foreach (var categoryId in (categoryIds ?? []).Distinct())
            c.Execute("INSERT INTO expense_categories (expense_id, category_id) VALUES (@expenseId, @categoryId)",
                new { expenseId, categoryId }, tx);
    }

    private static IResult? Validate(ExpenseInput input, Database db)
    {
        if (input.AmountCents <= 0 || input.AmountCents > MaxAmountCents)
            return ApiErrors.BadRequest("amount_invalid", "Enter an amount greater than zero.");
        if (input.Note is { Length: > MaxNoteLength })
            return ApiErrors.BadRequest("note_too_long", $"The note can be at most {MaxNoteLength} characters.");
        if (input.SpentAt is not null && Time.Normalize(input.SpentAt) is null)
            return ApiErrors.BadRequest("date_invalid", "Invalid date.");
        if (input.Latitude is < -90 or > 90 || input.Longitude is < -180 or > 180)
            return ApiErrors.BadRequest("location_invalid", "Invalid location.");
        var categoryIds = (input.CategoryIds ?? []).Distinct().ToArray();
        if (categoryIds.Length > MaxCategories)
            return ApiErrors.BadRequest("too_many_categories", $"An expense can have at most {MaxCategories} categories.");
        if (categoryIds.Length > 0)
        {
            using var c = db.Open();
            var found = c.ExecuteScalar<int>("SELECT COUNT(*) FROM categories WHERE id IN @categoryIds", new { categoryIds });
            if (found != categoryIds.Length)
                return ApiErrors.BadRequest("category_not_found", "That category doesn't exist.");
        }
        return null;
    }

    /// <summary>Validated input, cleaned up into the values that get stored (trimmed text, UTC time, location all-or-nothing).</summary>
    private sealed record ExpenseRow(
        long AmountCents, string? Note, string SpentAt,
        double? Latitude, double? Longitude, double? Accuracy, string? Place)
    {
        public long Id { get; init; }
        public long UserId { get; init; }
        public string? CreatedAt { get; init; }

        public static ExpenseRow From(ExpenseInput i)
        {
            var hasLocation = i.Latitude is not null && i.Longitude is not null;
            var place = hasLocation ? i.Place?.Trim() : null;
            return new ExpenseRow(
                i.AmountCents,
                string.IsNullOrWhiteSpace(i.Note) ? null : i.Note.Trim(),
                Time.Normalize(i.SpentAt) ?? Time.Now(),
                hasLocation ? i.Latitude : null,
                hasLocation ? i.Longitude : null,
                hasLocation ? i.Accuracy : null,
                string.IsNullOrEmpty(place) ? null : place[..Math.Min(place.Length, MaxPlaceLength)]);
        }
    }
}
