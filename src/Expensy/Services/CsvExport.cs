using System.Data;
using System.Globalization;
using System.Text;
using Dapper;

namespace Expensy.Services;

/// <summary>
/// Builds CSV files of expenses. Used by the export download (one user, their language)
/// and by the daily backup (everyone, English format, with a user column).
/// </summary>
public static class CsvExport
{
    /// <summary>Which expenses: one user's or everyone's (UserId null); one settlement, the current list, or all.</summary>
    public sealed record Filter(long? UserId, long? SettlementId = null, bool All = false);

    /// <summary>The CSV as UTF-8 with BOM (so Excel recognises Polish characters).</summary>
    public static byte[] Build(IDbConnection c, Filter filter, CsvFormat format, TimeZoneInfo zone, bool includeUser = false)
    {
        var rows = c.Query<Row>(
            """
            SELECT e.id, u.username AS user, e.spent_at, e.amount_cents, e.note, e.place, e.latitude, e.longitude,
                   s.name AS settlement
            FROM expenses e
            JOIN users u ON u.id = e.user_id
            LEFT JOIN settlements s ON s.id = e.settlement_id
            WHERE (@userId IS NULL OR e.user_id = @userId)
              AND (@all = 1
                   OR (@settlementId IS NULL AND e.settlement_id IS NULL)
                   OR e.settlement_id = @settlementId)
            ORDER BY u.username, e.spent_at
            """, new { userId = filter.UserId, settlementId = filter.SettlementId, all = filter.All ? 1 : 0 }).ToList();

        // Category names per expense, in the categories' list order.
        var categories = c.Query<(long ExpenseId, string Name, string? Key)>(
            """
            SELECT ec.expense_id, c.name, c.key
            FROM expense_categories ec JOIN categories c ON c.id = ec.category_id
            WHERE ec.expense_id IN @ids
            ORDER BY c.sort_order
            """, new { ids = rows.Select(r => r.Id) })
            .ToLookup(x => x.ExpenseId, x => format.CategoryName(x.Key, x.Name));

        var csv = new StringBuilder();
        var headers = includeUser ? format.Headers.Prepend(format.UserHeader) : format.Headers;
        csv.AppendJoin(format.Separator, headers).Append("\r\n");
        foreach (var r in rows)
        {
            var cells = new[]
            {
                Time.ToLocal(r.SpentAt, zone).ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
                (r.AmountCents / 100m).ToString("0.00", format.Culture),
                Quote(categories[r.Id].Any() ? string.Join(", ", categories[r.Id]) : format.Other),
                Quote(r.Note),
                Quote(r.Place),
                r.Latitude?.ToString(CultureInfo.InvariantCulture),
                r.Longitude?.ToString(CultureInfo.InvariantCulture),
                Quote(r.Settlement ?? format.CurrentList),
            };
            csv.AppendJoin(format.Separator, includeUser ? cells.Prepend(Quote(r.User)) : cells).Append("\r\n");
        }

        return [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(csv.ToString())];
    }

    /// <summary>Quotes a text cell; values starting with a formula character get a leading ' (CSV injection, OWASP).</summary>
    private static string Quote(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (value[0] is '=' or '+' or '-' or '@' or '\t' or '\r') value = "'" + value;
        return "\"" + value.Replace("\"", "\"\"") + "\"";
    }

    private sealed class Row
    {
        public long Id { get; set; }
        public string User { get; set; } = "";
        public string SpentAt { get; set; } = "";
        public long AmountCents { get; set; }
        public string? Note { get; set; }
        public string? Place { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public string? Settlement { get; set; }
    }
}

/// <summary>
/// CSV flavour per language. Polish Excel expects ";" and a decimal comma; English uses "," and a dot.
/// Built-in category names are translated here too (the frontend has the same names in i18n.js), and <c>Other</c>
/// is written for expenses without a category.
/// </summary>
public sealed record CsvFormat(
    string Separator, CultureInfo Culture, string[] Headers, string UserHeader, string CurrentList, string Other,
    Dictionary<string, string> Categories)
{
    public static CsvFormat For(string? lang) => lang == "pl" ? Polish : English;

    /// <summary>Built-in categories (with a key) get the translated name, renamed ones keep theirs.</summary>
    public string CategoryName(string? key, string storedName) =>
        key is not null && Categories.TryGetValue(key, out var translated) ? translated : storedName;

    public static readonly CsvFormat English = new(",", CultureInfo.InvariantCulture,
        ["Date", "Amount", "Categories", "Note", "Place", "Latitude", "Longitude", "Settlement"], "User",
        "(current list)", "Other", []);

    public static readonly CsvFormat Polish = new(";", CultureInfo.GetCultureInfo("pl-PL"),
        ["Data", "Kwota", "Kategorie", "Notatka", "Miejsce", "Szerokość", "Długość", "Rozliczenie"], "Użytkownik",
        "(bieżąca lista)", "Inne",
        new()
        {
            ["food"] = "Jedzenie", ["groceries"] = "Zakupy", ["transport"] = "Transport", ["fuel"] = "Paliwo",
            ["home"] = "Dom", ["bills"] = "Rachunki", ["health"] = "Zdrowie", ["entertainment"] = "Rozrywka",
            ["travel"] = "Podróże", ["clothes"] = "Ubrania", ["gifts"] = "Prezenty",
        });
}
