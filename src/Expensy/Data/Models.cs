using System.Text.Json.Serialization;

namespace Expensy.Data;

// Rows as read from SQLite (Dapper maps snake_case columns onto these properties, see Database)
// and the JSON bodies the API accepts. Timestamps are ISO-8601 UTC strings, money is integer cents.

public sealed class Category
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public string Icon { get; set; } = "";
    public string Color { get; set; } = "";
    public long SortOrder { get; set; }
    public bool Archived { get; set; }

    /// <summary>Pre-selected when adding a new expense (at most one category; stored in settings).</summary>
    public bool IsDefault { get; set; }

    /// <summary>Translation key of a built-in category ("food", "fuel"...); null once the user renames it.</summary>
    public string? Key { get; set; }
}

public sealed class Expense
{
    public long Id { get; set; }
    public long AmountCents { get; set; }
    public string? Note { get; set; }
    public string SpentAt { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? Accuracy { get; set; }
    public string? Place { get; set; }
    public string? Photo { get; set; }
    public long? SettlementId { get; set; }

    /// <summary>Owner of the expense — the only user who can see it.</summary>
    public long UserId { get; set; }

    /// <summary>Ids of the expense's categories (any number, also none).</summary>
    public long[] CategoryIds => string.IsNullOrEmpty(CategoryList) ? [] : CategoryList.Split(',').Select(long.Parse).ToArray();

    /// <summary>Comma-separated category ids as selected from SQL (see ExpenseEndpoints.SelectExpense).</summary>
    [JsonIgnore]
    public string? CategoryList { get; set; }

    /// <summary>URL the browser can load the photo from (null when there is no photo).</summary>
    public string? PhotoUrl => Photo is null ? null : $"/api/photos/{Photo}";
}

public sealed class Settlement
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public string SettledAt { get; set; } = "";
    public long TotalCents { get; set; }
    public long Count { get; set; }
    public string? FirstSpentAt { get; set; }
    public string? LastSpentAt { get; set; }
}

public sealed class User
{
    public long Id { get; set; }
    public string Username { get; set; } = "";
    /// <summary>Optional friendlier name shown in the app ("Bartek"); null → the username is shown.</summary>
    public string? DisplayName { get; set; }
    public bool IsAdmin { get; set; }
    public bool Active { get; set; }
    public string CreatedAt { get; set; } = "";

    [JsonIgnore] // never sent to the browser
    public string PasswordHash { get; set; } = "";
}

// ---------- Request bodies ----------

public sealed record CategoryInput(string Name, string Icon, string Color);

public sealed record ReorderInput(long[] Ids);

public sealed record ExpenseInput(
    long AmountCents,
    long[]? CategoryIds,
    string? Note,
    string? SpentAt,
    double? Latitude,
    double? Longitude,
    double? Accuracy,
    string? Place);

public sealed record SettleInput(string? Name);

public sealed record RenameInput(string Name);

public sealed record LoginInput(string Username, string Password);

public sealed record NewUserInput(string Username, string Password, string? DisplayName = null);

public sealed record DisplayNameInput(string? DisplayName);

public sealed record PasswordInput(string Password);

public sealed record ChangePasswordInput(string CurrentPassword, string NewPassword);

public sealed record SettingsInput(string Currency);
