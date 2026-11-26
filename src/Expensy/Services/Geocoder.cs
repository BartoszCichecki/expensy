using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Expensy.Services;

/// <summary>
/// Optional reverse geocoding (coordinates → "Tesco, London") using OpenStreetMap Nominatim.
/// Off unless EXPENSY_GEOCODING=true, because it sends coordinates to a third-party service.
/// Nominatim's usage policy allows ~1 request/second, which is plenty for one household.
/// </summary>
public sealed partial class Geocoder(HttpClient http, IConfiguration config, ILogger<Geocoder> logger)
{
    public bool Enabled => config.GetFlag("GEOCODING", logger);

    public async Task<string?> ReverseAsync(double lat, double lon, string? lang, CancellationToken ct)
    {
        if (!Enabled) return null;

        var language = lang is { Length: 2 } && lang.All(char.IsAsciiLetterLower) ? lang : "en";
        var url = string.Create(CultureInfo.InvariantCulture,
            $"https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language={language}&lat={lat}&lon={lon}");
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(5));
            using var doc = JsonDocument.Parse(await http.GetStringAsync(url, timeout.Token));
            return Describe(doc.RootElement);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogWarning("Reverse geocoding failed: {Message}", ex.Message);
            return null;
        }
    }

    private static string? Describe(JsonElement root)
    {
        string? Get(JsonElement e, string prop) =>
            e.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String && v.GetString() is { Length: > 0 } s ? s : null;

        var name = Get(root, "name");
        if (!root.TryGetProperty("address", out var addr)) return name;

        var city = Get(addr, "city") ?? Get(addr, "town") ?? Get(addr, "village") ?? Get(addr, "municipality");
        var road = Get(addr, "road");
        var house = Get(addr, "house_number");
        var street = road is null ? null : house is null ? road : $"{road} {house}";
        // For plain buildings OSM's "name" is just the house number ("40") — not useful, show the street instead.
        if (name is not null && (name == house || HouseNumber().IsMatch(name))) name = null;

        var parts = new[] { name ?? street, city }.Where(p => p is not null).Distinct();
        var result = string.Join(", ", parts);
        return result.Length > 0 ? result : null;
    }

    /// <summary>Looks like a house number: "40", "12a", "7/9".</summary>
    [GeneratedRegex(@"^\d+[a-zA-Z]?(/\d+[a-zA-Z]?)?$")]
    private static partial Regex HouseNumber();
}
