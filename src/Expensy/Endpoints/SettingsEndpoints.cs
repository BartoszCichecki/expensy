using Expensy.Data;
using Expensy.Services;
using Expensy.Web;

namespace Expensy.Endpoints;

/// <summary>App-wide settings shared by all users (currently: the currency); only the admin changes them.</summary>
public static class SettingsEndpoints
{
    /// <summary>Euro, the other European currencies, plus US dollar, Chinese yuan and Japanese yen.</summary>
    private static readonly HashSet<string> Currencies =
    [
        "EUR", "PLN", "GBP", "CHF", "DKK", "SEK", "NOK", "ISK", "CZK", "HUF", "RON", "BGN",
        "RSD", "UAH", "MDL", "ALL", "MKD", "BAM", "GEL", "TRY",
        "USD", "CNY", "JPY",
    ];

    public static void MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/settings", (Database db, Geocoder geocoder) =>
        {
            using var c = db.Open();
            return new
            {
                currency = c.GetSetting(Settings.Currency) ?? "EUR",
                currencies = Currencies.Order(),
                geocoding = geocoder.Enabled, // tells the app whether to show place names and mini maps
            };
        });

        // Shared by everyone, so only the admin can change it.
        app.MapPut("/api/settings", (SettingsInput input, Database db) =>
        {
            if (!Currencies.Contains(input.Currency))
                return ApiErrors.BadRequest("currency_invalid", "Unsupported currency.");
            using var c = db.Open();
            c.SetSetting(Settings.Currency, input.Currency);
            return Results.NoContent();
        }).RequireAdmin();
    }
}
