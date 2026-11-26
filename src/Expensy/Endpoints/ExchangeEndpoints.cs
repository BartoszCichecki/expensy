using System.Text.RegularExpressions;
using Expensy.Services;
using Expensy.Web;

namespace Expensy.Endpoints;

/// <summary>Exchange rates for entering an expense in another currency (see <see cref="ExchangeRates"/>).</summary>
public static partial class ExchangeEndpoints
{
    public static void MapExchangeEndpoints(this IEndpointRouteBuilder app)
    {
        // Currencies that can be converted (empty if the rate service can't be reached).
        app.MapGet("/api/exchange/currencies", (ExchangeRates rates, CancellationToken ct) => rates.CurrenciesAsync(ct));

        // ?from=EUR&to=PLN&date=2026-11-20 → { rate: 4.4583, date: "2026-11-20" }
        app.MapGet("/api/exchange/rate", async (string from, string to, DateOnly? date, ExchangeRates rates, CancellationToken ct) =>
        {
            if (!CurrencyCode().IsMatch(from) || !CurrencyCode().IsMatch(to))
                return ApiErrors.BadRequest("rate_unavailable", "Unknown currency.");
            var day = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
            return await rates.RateAsync(from, to, day, ct) is { } rate
                ? Results.Ok(new { rate = rate.Value, date = rate.Date })
                : ApiErrors.BadRequest("rate_unavailable", "The exchange rate isn't available right now.");
        });
    }

    [GeneratedRegex("^[A-Z]{3}$")]
    private static partial Regex CurrencyCode();
}
