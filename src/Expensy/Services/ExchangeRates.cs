using System.Collections.Concurrent;
using System.Globalization;
using System.Net.Http.Json;

namespace Expensy.Services;

/// <summary>
/// Daily reference exchange rates of the European Central Bank, from the free Frankfurter API (api.frankfurter.dev).
/// Used when an expense is entered in another currency than the app's: the amount is converted before saving.
/// Only currency codes and dates are sent. Answers are cached in memory (rates for a past day never change).
/// </summary>
public sealed class ExchangeRates(IHttpClientFactory httpFactory, ILogger<ExchangeRates> logger)
{
    public const string HttpClientName = "frankfurter";
    private static readonly TimeSpan CurrenciesMaxAge = TimeSpan.FromDays(1);

    private (DateTime Fetched, string[] Codes)? _currencies;
    private readonly ConcurrentDictionary<string, Rate> _rates = new();

    /// <summary>A rate and the day it was published on (the last working day on or before the requested one).</summary>
    public sealed record Rate(decimal Value, string Date);

    /// <summary>Currency codes Frankfurter has rates for; empty when it can't be reached.</summary>
    public async Task<string[]> CurrenciesAsync(CancellationToken ct)
    {
        if (_currencies is { } cached && DateTime.UtcNow - cached.Fetched < CurrenciesMaxAge) return cached.Codes;

        var names = await GetAsync<Dictionary<string, string>>("currencies", ct);
        if (names is null) return [];
        var codes = names.Keys.Order().ToArray();
        _currencies = (DateTime.UtcNow, codes);
        return codes;
    }

    /// <summary>How many `to` one `from` was worth on `date` (today at the latest). Null if unavailable.</summary>
    public async Task<Rate?> RateAsync(string from, string to, DateOnly date, CancellationToken ct)
    {
        if (from == to) return new Rate(1, date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var day = (date > today ? today : date).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var key = $"{day}:{from}:{to}";
        if (_rates.TryGetValue(key, out var cached)) return cached;

        var answer = await GetAsync<FrankfurterRates>($"{day}?base={from}&symbols={to}", ct);
        if (answer?.Rates.GetValueOrDefault(to) is not (> 0 and var value)) return null;

        var rate = new Rate(value, answer.Date);
        // Today's rate can still change until the ECB publishes it (around 16:00 CET), so only past days are cached.
        if (day != today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)) _rates[key] = rate;
        return rate;
    }

    private async Task<T?> GetAsync<T>(string path, CancellationToken ct) where T : class
    {
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(5));
            return await httpFactory.CreateClient(HttpClientName).GetFromJsonAsync<T>(path, timeout.Token);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            logger.LogWarning("Exchange rates unavailable ({Path}): {Message}", path, ex.Message);
            return null;
        }
    }

    private sealed record FrankfurterRates(string Date, Dictionary<string, decimal> Rates);
}
