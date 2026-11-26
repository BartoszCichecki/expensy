using Expensy.Services;

namespace Expensy.Web;

/// <summary>Request pipeline pieces that keep the app safe. Wired up in Program.cs.</summary>
public static class Security
{
    /// <summary>Name of the rate-limiting policy for login and first-run setup (10 attempts/minute per client IP).</summary>
    public const string LoginRateLimit = "login";

    /// <summary>Header every state-changing API request must carry (CSRF protection, see <see cref="UseApiGuard"/>).</summary>
    public const string CsrfHeader = "X-Expensy";

    /// <summary>API paths that work without being logged in.</summary>
    private static readonly string[] PublicApiPaths = ["/api/session", "/api/login", "/api/setup"];

    private const string ContentSecurityPolicy =
        "default-src 'self'; " +
        "script-src 'self'; " +                      // only our own scripts — no inline JS
        "style-src 'self' 'unsafe-inline'; " +       // inline style attributes are used for category colours
        "img-src 'self' blob: data: https://tile.openstreetmap.org; " + // photos, previews, map tiles
        "connect-src 'self'; worker-src 'self'; manifest-src 'self'; " +
        "object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

    /// <summary>Security headers on every response (no framing, no MIME sniffing, strict CSP).</summary>
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) => app.Use(async (ctx, next) =>
    {
        var headers = ctx.Response.Headers;
        headers.XContentTypeOptions = "nosniff";
        headers.XFrameOptions = "DENY";
        headers["Referrer-Policy"] = "same-origin";
        headers["Permissions-Policy"] = "geolocation=(self), camera=(), microphone=(), payment=()";
        headers.ContentSecurityPolicy = ContentSecurityPolicy;
        await next();
    });

    /// <summary>
    /// Guards /api:
    ///  1. CSRF — state-changing requests must carry the X-Expensy header. Browsers only let our own pages add
    ///     a custom header; another site (even a sibling subdomain) can't without a CORS preflight.
    ///  2. Login — everything except <see cref="PublicApiPaths"/> needs a session; the user is then available
    ///     to endpoints via <c>ctx.CurrentUser()</c>.
    /// </summary>
    public static IApplicationBuilder UseApiGuard(this IApplicationBuilder app) => app.Use(async (ctx, next) =>
    {
        var request = ctx.Request;
        if (!request.Path.StartsWithSegments("/api"))
        {
            await next();
            return;
        }

        var changesState = !HttpMethods.IsGet(request.Method) && !HttpMethods.IsHead(request.Method);
        if (changesState && request.Headers[CsrfHeader] != "1")
        {
            await ApiErrors.Forbidden("csrf", $"Missing {CsrfHeader} header.").ExecuteAsync(ctx);
            return;
        }

        var isPublic = PublicApiPaths.Any(p => request.Path.StartsWithSegments(p));
        if (!isPublic && ctx.RequestServices.GetRequiredService<Auth>().Resolve(ctx) is null)
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        await next();
    });

    /// <summary>Restricts endpoints to the admin (403 for everyone else).</summary>
    public static TBuilder RequireAdmin<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder =>
        builder.AddEndpointFilter(async (context, next) =>
            context.HttpContext.CurrentUser().IsAdmin ? await next(context) : ApiErrors.AdminOnly());
}
