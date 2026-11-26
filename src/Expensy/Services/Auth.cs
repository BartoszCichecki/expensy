using System.Security.Cryptography;
using System.Text;
using Dapper;
using Expensy.Data;

namespace Expensy.Services;

/// <summary>
/// User sessions. Logging in creates a long-lived cookie (one year) so the home-screen app stays signed in.
/// Only a SHA-256 hash of the session token is stored in the database.
/// The middleware in Program.cs resolves the user once per request; endpoints read it with ctx.CurrentUser().
/// </summary>
public sealed class Auth(Database db)
{
    public const string CookieName = "expensy_session";
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromDays(365);
    private const string UserItemKey = "expensy.user";

    /// <summary>True until the first (admin) account has been created on the setup screen.</summary>
    public bool SetupRequired()
    {
        using var c = db.Open();
        return c.ExecuteScalar<long>("SELECT COUNT(*) FROM users") == 0;
    }

    /// <summary>Returns the user if the username/password match an active account.</summary>
    public User? CheckCredentials(string username, string password)
    {
        using var c = db.Open();
        var user = c.QuerySingleOrDefault<User>("SELECT * FROM users WHERE username = @username AND active = 1", new { username });
        // Always run the (slow) hash check so response time doesn't reveal whether the username exists.
        var ok = Passwords.Verify(password, user?.PasswordHash ?? Passwords.Dummy);
        return ok ? user : null;
    }

    /// <summary>Looks up the user for the request's session cookie (null if not logged in) and caches it on the context.</summary>
    public User? Resolve(HttpContext ctx)
    {
        if (ctx.Request.Cookies[CookieName] is not { Length: > 0 } token) return null;

        using var c = db.Open();
        var user = c.QuerySingleOrDefault<User>(
            """
            SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token = @hash AND s.expires_at > @now AND u.active = 1
            """, new { hash = Hash(token), now = Time.Now() });
        if (user is not null) ctx.Items[UserItemKey] = user;
        return user;
    }

    public static User? Current(HttpContext ctx) => ctx.Items[UserItemKey] as User;

    public void SignIn(HttpContext ctx, User user)
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        using (var c = db.Open())
        {
            c.Execute("DELETE FROM sessions WHERE expires_at < @now", new { now = Time.Now() });
            c.Execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (@hash, @userId, @expires)",
                new { hash = Hash(token), userId = user.Id, expires = Time.Format(DateTime.UtcNow + SessionLifetime) });
        }

        ctx.Response.Cookies.Append(CookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = ctx.Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            MaxAge = SessionLifetime,
        });
    }

    public void SignOut(HttpContext ctx)
    {
        if (ctx.Request.Cookies[CookieName] is { Length: > 0 } token)
        {
            using var c = db.Open();
            c.Execute("DELETE FROM sessions WHERE token = @hash", new { hash = Hash(token) });
        }
        ctx.Response.Cookies.Delete(CookieName);
    }

    /// <summary>Logs a user out everywhere (after deactivation or a password reset).</summary>
    public void EndAllSessions(long userId, HttpContext? keepCurrent = null)
    {
        using var c = db.Open();
        var keep = keepCurrent?.Request.Cookies[CookieName] is { Length: > 0 } token ? Hash(token) : "";
        c.Execute("DELETE FROM sessions WHERE user_id = @userId AND token <> @keep", new { userId, keep });
    }

    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

public static class HttpContextUserExtensions
{
    /// <summary>The logged-in user. Only call from endpoints behind the auth middleware (all of /api except session/login/setup).</summary>
    public static User CurrentUser(this HttpContext ctx) =>
        Auth.Current(ctx) ?? throw new InvalidOperationException("No user on this request.");
}
