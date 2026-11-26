using System.Security.Cryptography;
using Dapper;
using Expensy.Data;

namespace Expensy.Services;

/// <summary>
/// Emergency commands run from the server's shell, e.g. when the admin forgot their password:
///
///   docker exec expensy dotnet Expensy.dll list-users
///   docker exec expensy dotnet Expensy.dll reset-password admin
///
/// They work directly on the database (no login needed — having shell access to the server is the authorization).
/// </summary>
public static class Cli
{
    private static readonly string[] Commands = ["reset-password", "list-users", "help"];

    public static bool IsCommand(string arg) => Commands.Contains(arg);

    public static int Run(string[] args, Database db)
    {
        db.Migrate();
        switch (args)
        {
            case ["list-users"]:
                return ListUsers(db);
            case ["reset-password", var username]:
                return ResetPassword(db, username);
            default:
                Console.WriteLine(
                    """
                    Expensy emergency commands:
                      list-users                  show all accounts
                      reset-password <username>   set a new random password, re-activate the account
                                                  and log it out everywhere
                    """);
                return args is ["help"] ? 0 : 1;
        }
    }

    private static int ListUsers(Database db)
    {
        using var c = db.Open();
        foreach (var u in c.Query<User>("SELECT * FROM users ORDER BY is_admin DESC, username"))
            Console.WriteLine($"{u.Username,-32} {(u.IsAdmin ? "admin" : "user"),-6} {(u.Active ? "active" : "deactivated")}");
        return 0;
    }

    private static int ResetPassword(Database db, string username)
    {
        // 16 characters from an unambiguous alphabet (no 0/O, 1/l/I).
        const string alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var password = RandomNumberGenerator.GetString(alphabet, 16);

        using var c = db.Open();
        var id = c.ExecuteScalar<long?>("SELECT id FROM users WHERE username = @username", new { username });
        if (id is null)
        {
            Console.Error.WriteLine($"No user named '{username}'. Run 'list-users' to see accounts.");
            return 1;
        }

        c.Execute("UPDATE users SET password_hash = @hash, active = 1 WHERE id = @id", new { hash = Passwords.Hash(password), id });
        c.Execute("DELETE FROM sessions WHERE user_id = @id", new { id });
        Console.WriteLine($"New password for '{username}': {password}");
        Console.WriteLine("Log in with it and change it in Settings → Account.");
        return 0;
    }
}
