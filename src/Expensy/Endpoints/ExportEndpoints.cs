using System.Text.RegularExpressions;
using Expensy.Data;
using Expensy.Services;

namespace Expensy.Endpoints;

/// <summary>CSV download of the logged-in user's expenses (the file itself is built by <see cref="CsvExport"/>).</summary>
public static partial class ExportEndpoints
{
    public static void MapExportEndpoints(this IEndpointRouteBuilder app)
    {
        // Which expenses: ?settlementId=5 → one settlement, ?all=true → everything, nothing → the current list.
        // tz   = the browser's IANA time zone, so dates in the file match what the user sees in the app.
        // lang = the app language: column names, plus separators that open correctly in that locale's Excel.
        app.MapGet("/api/export.csv", (long? settlementId, bool? all, string? tz, string? lang, Database db, HttpContext ctx) =>
        {
            using var c = db.Open();
            var filter = new CsvExport.Filter(ctx.CurrentUser().Id, settlementId, all == true);
            var csv = CsvExport.Build(c, filter, CsvFormat.For(lang), FindTimeZone(tz));
            return Results.File(csv, "text/csv; charset=utf-8", $"expensy-{DateTime.UtcNow:yyyy-MM-dd}.csv");
        });
    }

    /// <summary>Only plain IANA ids like "Europe/Warsaw" are looked up; anything else falls back to UTC.</summary>
    private static TimeZoneInfo FindTimeZone(string? tz)
    {
        if (tz is null || !IanaZoneId().IsMatch(tz) || tz.Contains("..")) return TimeZoneInfo.Utc;
        try { return TimeZoneInfo.FindSystemTimeZoneById(tz); }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException) { return TimeZoneInfo.Utc; }
    }

    [GeneratedRegex(@"^[A-Za-z][A-Za-z0-9_+\-]*(/[A-Za-z0-9_+\-]+){0,2}$")]
    private static partial Regex IanaZoneId();
}
