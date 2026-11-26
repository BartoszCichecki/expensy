using System.Globalization;

namespace Expensy.Services;

/// <summary>
/// All timestamps are stored as fixed-format UTC strings ("2026-11-26T17:42:00.000Z"),
/// so they sort correctly as plain text in SQLite.
/// </summary>
public static class Time
{
    private const string Pattern = "yyyy-MM-dd'T'HH:mm:ss.fff'Z'";

    public static string Now() => Format(DateTime.UtcNow);

    public static string Format(DateTime utc) => utc.ToString(Pattern, CultureInfo.InvariantCulture);

    /// <summary>Normalises any ISO-8601 timestamp from the client to the stored UTC format; null/invalid → null.</summary>
    public static string? Normalize(string? value) =>
        DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed)
            ? Format(parsed.UtcDateTime)
            : null;

    /// <summary>A stored UTC timestamp converted to the given time zone.</summary>
    public static DateTime ToLocal(string stored, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTimeFromUtc(
            DateTime.Parse(stored, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal),
            zone);
}
