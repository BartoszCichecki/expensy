namespace Expensy.Web;

/// <summary>
/// Error responses of the API. They all have the same shape: <c>{ "error": "English message", "code": "machine_code" }</c>.
/// The frontend shows the translation of <c>errors.&lt;code&gt;</c> from i18n.js and falls back to the English message.
/// </summary>
public static class ApiErrors
{
    /// <summary>400 — the request is invalid (failed validation).</summary>
    public static IResult BadRequest(string code, string message) => Error(StatusCodes.Status400BadRequest, code, message);

    /// <summary>401 — wrong credentials.</summary>
    public static IResult Unauthorized(string code, string message) => Error(StatusCodes.Status401Unauthorized, code, message);

    /// <summary>403 — logged in, but not allowed to do this.</summary>
    public static IResult Forbidden(string code, string message) => Error(StatusCodes.Status403Forbidden, code, message);

    public static IResult AdminOnly() => Forbidden("admin_only", "Only the admin can do this.");

    private static IResult Error(int status, string code, string message) =>
        Results.Json(new { error = message, code }, statusCode: status);
}
