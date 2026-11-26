using Dapper;
using Microsoft.Data.Sqlite;

namespace Expensy.Data;

/// <summary>
/// Owns the SQLite connection string and the schema.
/// Schema changes are applied as numbered migrations tracked with PRAGMA user_version.
/// Once Expensy runs somewhere with real data, change the schema by appending a new entry to
/// <see cref="Migrations"/> — never edit one that has already run on a real database.
/// </summary>
public sealed class Database
{
    private readonly string _connectionString;

    static Database()
    {
        // Lets Dapper map snake_case columns (amount_cents) onto C# properties (AmountCents).
        DefaultTypeMap.MatchNamesWithUnderscores = true;
    }

    public Database(AppPaths paths)
    {
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = paths.DatabaseFile,
            ForeignKeys = true,
            Cache = SqliteCacheMode.Shared,
        }.ToString();
    }

    public SqliteConnection Open()
    {
        var connection = new SqliteConnection(_connectionString);
        connection.Open();
        return connection;
    }

    private static readonly string[] Migrations =
    [
        // 1: initial schema
        """
        -- The first user (created on the setup screen) is the admin; the admin adds the others.
        CREATE TABLE users (
            id            INTEGER PRIMARY KEY,
            username      TEXT    NOT NULL UNIQUE COLLATE NOCASE, -- for logging in
            display_name  TEXT,                                   -- optional, shown in the app instead of the username
            password_hash TEXT    NOT NULL,
            is_admin      INTEGER NOT NULL DEFAULT 0,
            active        INTEGER NOT NULL DEFAULT 1,
            created_at    TEXT    NOT NULL
        );

        CREATE TABLE sessions (
            token      TEXT    PRIMARY KEY, -- SHA-256 of the cookie value
            user_id    INTEGER NOT NULL REFERENCES users(id),
            expires_at TEXT    NOT NULL
        );

        CREATE TABLE categories (
            id          INTEGER PRIMARY KEY,
            name        TEXT    NOT NULL,
            icon        TEXT    NOT NULL,
            color       TEXT    NOT NULL,
            sort_order  INTEGER NOT NULL DEFAULT 0,
            archived    INTEGER NOT NULL DEFAULT 0,
            key         TEXT -- built-in categories: translation key, shown in the app's language until renamed
        );

        -- Every user has their own current list and archive; categories and settings are shared.
        CREATE TABLE settlements (
            id          INTEGER PRIMARY KEY,
            user_id     INTEGER NOT NULL REFERENCES users(id),
            name        TEXT    NOT NULL,
            settled_at  TEXT    NOT NULL
        );
        CREATE INDEX ix_settlements_user ON settlements(user_id, settled_at);

        CREATE TABLE expenses (
            id            INTEGER PRIMARY KEY,
            amount_cents  INTEGER NOT NULL,
            note          TEXT,
            spent_at      TEXT    NOT NULL,
            created_at    TEXT    NOT NULL,
            user_id       INTEGER NOT NULL REFERENCES users(id), -- owner; only they can see it
            latitude      REAL,
            longitude     REAL,
            accuracy      REAL,
            place         TEXT,
            photo         TEXT,
            settlement_id INTEGER REFERENCES settlements(id) -- NULL = on the current list
        );
        CREATE INDEX ix_expenses_user ON expenses(user_id, settlement_id, spent_at);

        -- An expense can have several categories (or none).
        CREATE TABLE expense_categories (
            expense_id  INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
            category_id INTEGER NOT NULL REFERENCES categories(id),
            PRIMARY KEY (expense_id, category_id)
        );

        CREATE TABLE settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        INSERT INTO categories (key, name, icon, color, sort_order) VALUES
            ('food',          'Food',          '🍔', '#f97316', 1),
            ('groceries',     'Groceries',     '🛒', '#22c55e', 2),
            ('transport',     'Transport',     '🚗', '#3b82f6', 3),
            ('fuel',          'Fuel',          '⛽', '#64748b', 4),
            ('home',          'Home',          '🏠', '#a855f7', 5),
            ('bills',         'Bills',         '🧾', '#0ea5e9', 6),
            ('health',        'Health',        '💊', '#ef4444', 7),
            ('entertainment', 'Entertainment', '🎬', '#ec4899', 8),
            ('travel',        'Travel',        '✈️', '#14b8a6', 9),
            ('clothes',       'Clothes',       '👕', '#eab308', 10),
            ('gifts',         'Gifts',         '🎁', '#f43f5e', 11);

        INSERT INTO settings (key, value) VALUES ('currency', 'PLN');
        """,
    ];

    public void Migrate()
    {
        using var connection = Open();
        connection.Execute("PRAGMA journal_mode = WAL;");

        var version = connection.ExecuteScalar<long>("PRAGMA user_version;");
        for (var i = (int)version; i < Migrations.Length; i++)
        {
            using var tx = connection.BeginTransaction();
            connection.Execute(Migrations[i], transaction: tx);
            connection.Execute($"PRAGMA user_version = {i + 1};", transaction: tx);
            tx.Commit();
        }
    }
}
