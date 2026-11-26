using System.Data;
using System.Text.RegularExpressions;
using Dapper;
using Expensy.Data;
using Expensy.Services;
using Expensy.Web;

namespace Expensy.Endpoints;

/// <summary>
/// First-run setup, login/logout, the user's own account, and user management (admin only).
/// Every user has their own expenses; the admin manages accounts but can't see anyone's expenses.
/// </summary>
public static partial class UserEndpoints
{
    private const int MaxDisplayNameLength = 50;

    public static void MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        // ----- session (public) -----

        // Tells the app whether to show the setup screen, the login screen or the app itself.
        app.MapGet("/api/session", (Auth auth, HttpContext ctx) => new
        {
            setupRequired = auth.SetupRequired(),
            user = auth.Resolve(ctx),
            version = AppVersion.Current,
        });

        // Creates the admin account; only works while there are no users at all.
        app.MapPost("/api/setup", (NewUserInput input, Database db, Auth auth, HttpContext ctx) =>
        {
            if (NewUserProblem(input) is { } error) return error;

            using var c = db.Open();
            using var tx = c.BeginTransaction();
            if (c.ExecuteScalar<bool>("SELECT EXISTS (SELECT 1 FROM users)", transaction: tx))
                return ApiErrors.BadRequest("setup_done", "The admin account already exists. Log in instead.");
            var id = Insert(c, tx, input, isAdmin: true);
            tx.Commit();

            var admin = Get(c, id)!;
            auth.SignIn(ctx, admin);
            return Results.Ok(admin);
        }).RequireRateLimiting(Security.LoginRateLimit);

        app.MapPost("/api/login", async (LoginInput input, Auth auth, HttpContext ctx) =>
        {
            // An over-long password can't be valid — don't spend time hashing it.
            var password = input.Password ?? "";
            var user = password.Length <= Passwords.MaxLength
                ? auth.CheckCredentials(input.Username?.Trim() ?? "", password)
                : null;
            if (user is null)
            {
                await Task.Delay(300); // slows down guessing, on top of the rate limit
                return ApiErrors.Unauthorized("login_invalid", "Wrong username or password.");
            }
            auth.SignIn(ctx, user);
            return Results.Ok(user);
        }).RequireRateLimiting(Security.LoginRateLimit);

        app.MapPost("/api/logout", (Auth auth, HttpContext ctx) =>
        {
            auth.SignOut(ctx);
            return Results.NoContent();
        });

        // ----- my account -----

        app.MapPut("/api/me/password", (ChangePasswordInput input, Database db, Auth auth, HttpContext ctx) =>
        {
            var me = ctx.CurrentUser();
            if (!Passwords.Verify(input.CurrentPassword ?? "", me.PasswordHash))
                return ApiErrors.BadRequest("current_password_invalid", "The current password is wrong.");
            if (PasswordProblem(input.NewPassword) is { } error) return error;

            using var c = db.Open();
            SetPassword(c, me.Id, input.NewPassword);
            auth.EndAllSessions(me.Id, keepCurrent: ctx); // other devices have to log in again
            return Results.NoContent();
        });

        app.MapPut("/api/me/display-name", (DisplayNameInput input, Database db, HttpContext ctx) =>
        {
            if (DisplayNameProblem(input.DisplayName) is { } error) return error;
            var id = ctx.CurrentUser().Id;
            using var c = db.Open();
            c.Execute("UPDATE users SET display_name = @name WHERE id = @id", new { name = CleanDisplayName(input.DisplayName), id });
            return Results.Ok(Get(c, id));
        });

        app.MapPost("/api/me/logout-others", (Auth auth, HttpContext ctx) =>
        {
            auth.EndAllSessions(ctx.CurrentUser().Id, keepCurrent: ctx);
            return Results.NoContent();
        });

        // ----- user management (admin only) -----

        var users = app.MapGroup("/api/users").RequireAdmin();

        users.MapGet("/", (Database db) =>
        {
            using var c = db.Open();
            return c.Query<User>("SELECT * FROM users ORDER BY is_admin DESC, username");
        });

        // New users are never admins — there is exactly one admin, created on the setup screen.
        users.MapPost("/", (NewUserInput input, Database db) =>
        {
            if (NewUserProblem(input) is { } error) return error;

            using var c = db.Open();
            using var tx = c.BeginTransaction();
            if (c.ExecuteScalar<bool>("SELECT EXISTS (SELECT 1 FROM users WHERE username = @u)", new { u = input.Username.Trim() }, tx))
                return ApiErrors.BadRequest("username_taken", "That username is already taken.");
            var id = Insert(c, tx, input, isAdmin: false);
            tx.Commit();
            return Results.Ok(Get(c, id));
        });

        users.MapPut("/{id:long}/password", (long id, PasswordInput input, Database db, Auth auth, HttpContext ctx) =>
        {
            if (PasswordProblem(input.Password) is { } error) return error;
            using var c = db.Open();
            if (!SetPassword(c, id, input.Password)) return Results.NotFound();
            auth.EndAllSessions(id, keepCurrent: id == ctx.CurrentUser().Id ? ctx : null);
            return Results.NoContent();
        });

        // Deactivated users can't log in; their data stays and they can be activated again.
        users.MapPost("/{id:long}/deactivate", (long id, Database db, Auth auth, HttpContext ctx) =>
        {
            if (id == ctx.CurrentUser().Id)
                return ApiErrors.BadRequest("cannot_deactivate_self", "You can't deactivate your own account.");
            using var c = db.Open();
            c.Execute("UPDATE users SET active = 0 WHERE id = @id", new { id });
            auth.EndAllSessions(id);
            return Get(c, id) is { } user ? Results.Ok(user) : Results.NotFound();
        });

        users.MapPost("/{id:long}/activate", (long id, Database db) =>
        {
            using var c = db.Open();
            c.Execute("UPDATE users SET active = 1 WHERE id = @id", new { id });
            return Get(c, id) is { } user ? Results.Ok(user) : Results.NotFound();
        });
    }

    // ----- data access -----

    private static User? Get(IDbConnection c, long id) =>
        c.QuerySingleOrDefault<User>("SELECT * FROM users WHERE id = @id", new { id });

    private static long Insert(IDbConnection c, IDbTransaction tx, NewUserInput input, bool isAdmin) =>
        c.ExecuteScalar<long>(
            """
            INSERT INTO users (username, display_name, password_hash, is_admin, active, created_at)
            VALUES (@username, @displayName, @hash, @isAdmin, 1, @now)
            RETURNING id
            """, new
            {
                username = input.Username.Trim(),
                displayName = CleanDisplayName(input.DisplayName),
                hash = Passwords.Hash(input.Password),
                isAdmin,
                now = Time.Now(),
            }, tx);

    private static bool SetPassword(IDbConnection c, long id, string password) =>
        c.Execute("UPDATE users SET password_hash = @hash WHERE id = @id", new { hash = Passwords.Hash(password), id }) > 0;

    /// <summary>Trimmed display name, or null when empty (the app then shows the username).</summary>
    private static string? CleanDisplayName(string? name) => string.IsNullOrWhiteSpace(name) ? null : name.Trim();

    // ----- validation (null = OK) -----

    private static IResult? NewUserProblem(NewUserInput input) =>
        UsernameProblem(input.Username) ?? PasswordProblem(input.Password) ?? DisplayNameProblem(input.DisplayName);

    private static IResult? UsernameProblem(string? username) =>
        username is null || !ValidUsername().IsMatch(username.Trim())
            ? ApiErrors.BadRequest("username_invalid", "Username must be 1-32 letters, digits, '.', '_' or '-'.")
            : null;

    private static IResult? PasswordProblem(string? password) =>
        password is null || password.Length < Passwords.MinLength || password.Length > Passwords.MaxLength
            ? ApiErrors.BadRequest("password_length", $"Password must be {Passwords.MinLength}-{Passwords.MaxLength} characters.")
            : null;

    private static IResult? DisplayNameProblem(string? name) =>
        CleanDisplayName(name) is { Length: > MaxDisplayNameLength } || (name?.Any(char.IsControl) ?? false)
            ? ApiErrors.BadRequest("display_name_invalid", $"Display name can be at most {MaxDisplayNameLength} characters.")
            : null;

    [GeneratedRegex(@"^[\p{L}\p{N}._-]{1,32}$")]
    private static partial Regex ValidUsername();
}
