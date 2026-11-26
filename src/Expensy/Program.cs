using System.Threading.RateLimiting;
using Expensy.Data;
using Expensy.Endpoints;
using Expensy.Services;
using Expensy.Web;
using Microsoft.AspNetCore.HttpOverrides;

// Expensy — a small self-hosted expense tracker.
//
// Configuration (environment variables with the EXPENSY_ prefix):
//   EXPENSY_DATA_DIR         where the database and photos live (/data in Docker, ../../data when developing)
//   EXPENSY_GEOCODING        "true" → place names and mini maps via OpenStreetMap
//   EXPENSY_TRUSTED_PROXIES  reverse proxies whose X-Forwarded-* headers are trusted (default: private networks)
//   EXPENSY_BACKUP           daily CSV backups to <data dir>/backups, keeping this many (default: 0 = off)
//
// Emergency commands, e.g. `docker exec expensy dotnet Expensy.dll reset-password admin` — see Services/Cli.cs.

var isCli = args.Length > 0 && Cli.IsCommand(args[0]);
var builder = WebApplication.CreateBuilder(isCli ? [] : args);
builder.Configuration.AddEnvironmentVariables("EXPENSY_");

var dataDir = Path.GetFullPath(builder.Configuration["DATA_DIR"] ?? "expensy-data", builder.Environment.ContentRootPath);
AppPaths paths;
try
{
    paths = new AppPaths(dataDir);
}
catch (DataDirNotWritableException ex)
{
    Console.Error.WriteLine(ex.Message); // a clear instruction instead of a stack trace
    return 1;
}
if (isCli) return Cli.Run(args, new Database(paths));

// ---------- Services ----------

builder.Services.AddSingleton(paths);
builder.Services.AddSingleton<Database>();
builder.Services.AddSingleton<PhotoStore>();
builder.Services.AddSingleton<Auth>();
builder.Services.AddSingleton<PlaceFiller>();
builder.Services.AddHostedService<BackupService>();
builder.Services.AddHttpClient<Geocoder>(http =>
    http.DefaultRequestHeaders.UserAgent.ParseAdd("Expensy/1.0 (self-hosted expense tracker)"));
builder.Services.AddSingleton<ExchangeRates>();
builder.Services.AddHttpClient(ExchangeRates.HttpClientName, http =>
{
    http.BaseAddress = new Uri("https://api.frankfurter.dev/v1/");
    http.DefaultRequestHeaders.UserAgent.ParseAdd("Expensy/1.0 (self-hosted expense tracker)");
});

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy(Security.LoginRateLimit, ctx => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
});

// Expensy usually runs behind a reverse proxy (Caddy, Traefik, Cloudflare Tunnel...) that terminates HTTPS.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.ForwardLimit = null; // follow a chain of trusted proxies (e.g. Cloudflare Tunnel → Caddy)
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
    foreach (var network in TrustedProxies.Parse(builder.Configuration["TRUSTED_PROXIES"]))
        o.KnownIPNetworks.Add(network);
});

// ---------- Pipeline ----------

var app = builder.Build();
app.Logger.LogInformation("Expensy {Version}", AppVersion.Current);
app.Services.GetRequiredService<Database>().Migrate();

app.UseForwardedHeaders(); // first, so the real client IP and scheme are known to everything below
app.UseSecurityHeaders();
app.UseApiGuard();
app.UseRateLimiter();

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    // index.html, app.js etc. are always revalidated, so updates show up right away.
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "no-cache",
});

// ---------- API ----------

app.MapUserEndpoints();
app.MapExpenseEndpoints();
app.MapSettlementEndpoints();
app.MapCategoryEndpoints();
app.MapSettingsEndpoints();
app.MapExchangeEndpoints();
app.MapExportEndpoints();
app.MapGet("/healthz", () => "ok");

app.Run();
return 0;
