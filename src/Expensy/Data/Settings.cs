using System.Data;
using Dapper;

namespace Expensy.Data;

/// <summary>
/// App-wide settings, stored as key/value rows in the <c>settings</c> table (shared by all users).
/// Use the constants below instead of typing key strings.
/// </summary>
public static class Settings
{
    /// <summary>Currency code shown everywhere, e.g. "PLN".</summary>
    public const string Currency = "currency";

    /// <summary>Id of the category pre-selected in the "new expense" form (absent = none).</summary>
    public const string DefaultCategory = "default_category";

    public static string? GetSetting(this IDbConnection c, string key) =>
        c.ExecuteScalar<string?>("SELECT value FROM settings WHERE key = @key", new { key });

    public static void SetSetting(this IDbConnection c, string key, string value) =>
        c.Execute("INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)", new { key, value });

    public static void RemoveSetting(this IDbConnection c, string key) =>
        c.Execute("DELETE FROM settings WHERE key = @key", new { key });
}
