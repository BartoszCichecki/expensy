namespace Expensy.Services;

/// <summary>
/// Reading EXPENSY_* options without crashing on typos: an empty or invalid value means "use the default"
/// (with a warning in the log), instead of the app refusing to start.
/// </summary>
public static class ConfigExtensions
{
    public static bool GetFlag(this IConfiguration config, string key, ILogger logger) =>
        Read(config, key, logger, bool.TryParse, false);

    public static int GetNumber(this IConfiguration config, string key, ILogger logger) =>
        Read(config, key, logger, int.TryParse, 0);

    private delegate bool TryParse<T>(string? text, out T value);

    private static T Read<T>(IConfiguration config, string key, ILogger logger, TryParse<T> parse, T fallback)
    {
        var text = config[key];
        if (string.IsNullOrWhiteSpace(text)) return fallback;
        if (parse(text.Trim(), out var value)) return value;
        logger.LogWarning("Ignoring EXPENSY_{Key}={Value}: not a valid value, using {Fallback}", key, text, fallback);
        return fallback;
    }
}
