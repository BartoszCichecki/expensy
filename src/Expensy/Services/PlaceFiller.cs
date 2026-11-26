using Dapper;
using Expensy.Data;

namespace Expensy.Services;

/// <summary>
/// Makes sure expenses with coordinates get a place name ("Biedronka, Warszawa") when geocoding is on.
///
/// The app normally looks the name up while the form is open, but if the user saves faster than OpenStreetMap
/// answers — or the expense was added before geocoding was switched on — the name is missing. Then:
///   - after create/update, <see cref="FillInBackground"/> looks it up without making the save wait;
///   - opening an older expense calls <see cref="FillNowAsync"/> to fill it in on demand.
/// </summary>
public sealed class PlaceFiller(Database db, IServiceScopeFactory scopes, ILogger<PlaceFiller> logger)
{
    public void FillInBackground(Expense expense, string? lang)
    {
        if (!Needs(expense)) return;
        _ = Task.Run(async () =>
        {
            try { await LookUpAndStore(expense, lang, CancellationToken.None); }
            catch (Exception ex) { logger.LogWarning(ex, "Filling in the place of expense {Id} failed", expense.Id); }
        });
    }

    /// <summary>Looks up and stores the place right away; returns true if it was filled in.</summary>
    public Task<bool> FillNowAsync(Expense expense, string? lang, CancellationToken ct) =>
        Needs(expense) ? LookUpAndStore(expense, lang, ct) : Task.FromResult(false);

    private static bool Needs(Expense e) => e is { Latitude: not null, Longitude: not null, Place: null };

    private async Task<bool> LookUpAndStore(Expense e, string? lang, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var geocoder = scope.ServiceProvider.GetRequiredService<Geocoder>();
        if (!geocoder.Enabled) return false;

        var place = await geocoder.ReverseAsync(e.Latitude!.Value, e.Longitude!.Value, lang, ct);
        if (place is null) return false;

        using var c = db.Open();
        // Only if nothing changed meanwhile (the user may have edited or removed the location).
        return c.Execute(
            """
            UPDATE expenses SET place = @place
            WHERE id = @id AND place IS NULL AND latitude = @lat AND longitude = @lon
            """, new { place, id = e.Id, lat = e.Latitude, lon = e.Longitude }) > 0;
    }
}
