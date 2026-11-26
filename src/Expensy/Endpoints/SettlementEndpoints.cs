using System.Data;
using Dapper;
using Expensy.Data;
using Expensy.Services;
using Expensy.Web;

namespace Expensy.Endpoints;

/// <summary>
/// Settling up = closing the current list. All of the user's open expenses get attached to a new settlement
/// (which shows up in their archive) and their current list starts empty again.
/// Every user has their own list and archive; all queries are scoped to the logged-in user.
/// </summary>
public static class SettlementEndpoints
{
    private const int MaxNameLength = 100;

    private const string SelectWithTotals =
        """
        SELECT s.id, s.name, s.settled_at,
               COALESCE(SUM(e.amount_cents), 0) AS total_cents,
               COUNT(e.id)                      AS count,
               MIN(e.spent_at)                  AS first_spent_at,
               MAX(e.spent_at)                  AS last_spent_at
        FROM settlements s
        LEFT JOIN expenses e ON e.settlement_id = s.id
        WHERE s.user_id = @userId
        """;

    public static void MapSettlementEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api/settlements");

        api.MapGet("/", (Database db, HttpContext ctx) =>
        {
            using var c = db.Open();
            return c.Query<Settlement>($"{SelectWithTotals} GROUP BY s.id ORDER BY s.settled_at DESC", new { userId = ctx.CurrentUser().Id });
        });

        api.MapGet("/{id:long}", (long id, Database db, HttpContext ctx) =>
        {
            using var c = db.Open();
            return Get(c, id, ctx.CurrentUser().Id) is { } s ? Results.Ok(s) : Results.NotFound();
        });

        api.MapPost("/", (SettleInput input, Database db, HttpContext ctx) =>
        {
            var userId = ctx.CurrentUser().Id;
            using var c = db.Open();
            using var tx = c.BeginTransaction();

            if (!c.ExecuteScalar<bool>("SELECT EXISTS (SELECT 1 FROM expenses WHERE user_id = @userId AND settlement_id IS NULL)",
                    new { userId }, tx))
                return ApiErrors.BadRequest("settle_empty", "The list is empty - nothing to settle.");

            var name = string.IsNullOrWhiteSpace(input.Name)
                ? $"Settlement {DateTime.Now:yyyy-MM-dd}" // the app always sends a name; this is a fallback
                : input.Name.Trim();

            var id = c.ExecuteScalar<long>(
                "INSERT INTO settlements (user_id, name, settled_at) VALUES (@userId, @name, @now) RETURNING id",
                new { userId, name, now = Time.Now() }, tx);
            c.Execute("UPDATE expenses SET settlement_id = @id WHERE user_id = @userId AND settlement_id IS NULL",
                new { id, userId }, tx);
            tx.Commit();

            return Results.Ok(Get(c, id, userId));
        });

        api.MapPut("/{id:long}", (long id, RenameInput input, Database db, HttpContext ctx) =>
        {
            if (string.IsNullOrWhiteSpace(input.Name) || input.Name.Trim().Length > MaxNameLength)
                return ApiErrors.BadRequest("settlement_name_invalid", $"Name must be 1-{MaxNameLength} characters.");
            var userId = ctx.CurrentUser().Id;
            using var c = db.Open();
            c.Execute("UPDATE settlements SET name = @name WHERE id = @id AND user_id = @userId",
                new { name = input.Name.Trim(), id, userId });
            return Get(c, id, userId) is { } s ? Results.Ok(s) : Results.NotFound();
        });

        // Undo: move the settlement's expenses back to the current list.
        api.MapPost("/{id:long}/reopen", (long id, Database db, HttpContext ctx) =>
        {
            var userId = ctx.CurrentUser().Id;
            using var c = db.Open();
            using var tx = c.BeginTransaction();
            if (!IsOwn(c, id, userId, tx)) return Results.NotFound();
            c.Execute("UPDATE expenses SET settlement_id = NULL WHERE settlement_id = @id", new { id }, tx);
            c.Execute("DELETE FROM settlements WHERE id = @id", new { id }, tx);
            tx.Commit();
            return Results.NoContent();
        });

        // Permanently removes the settlement together with its expenses and photos.
        api.MapDelete("/{id:long}", (long id, Database db, PhotoStore photos, HttpContext ctx) =>
        {
            var userId = ctx.CurrentUser().Id;
            using var c = db.Open();
            using var tx = c.BeginTransaction();
            if (!IsOwn(c, id, userId, tx)) return Results.NotFound();
            var photoNames = c.Query<string>(
                "SELECT photo FROM expenses WHERE settlement_id = @id AND photo IS NOT NULL", new { id }, tx).ToList();
            c.Execute("DELETE FROM expenses WHERE settlement_id = @id", new { id }, tx);
            c.Execute("DELETE FROM settlements WHERE id = @id", new { id }, tx);
            tx.Commit();

            photoNames.ForEach(photos.Delete);
            return Results.NoContent();
        });
    }

    private static bool IsOwn(IDbConnection c, long id, long userId, IDbTransaction tx) =>
        c.ExecuteScalar<bool>("SELECT EXISTS (SELECT 1 FROM settlements WHERE id = @id AND user_id = @userId)", new { id, userId }, tx);

    private static Settlement? Get(IDbConnection c, long id, long userId) =>
        c.QuerySingleOrDefault<Settlement>($"{SelectWithTotals} AND s.id = @id GROUP BY s.id", new { id, userId });
}
