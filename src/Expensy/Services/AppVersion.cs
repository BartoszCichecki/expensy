using System.Reflection;

namespace Expensy.Services;

/// <summary>
/// The app version, e.g. "1.0". Comes from &lt;Version&gt; in Expensy.csproj, or from the git tag when the
/// Docker image is built by GitHub Actions (passed as -p:InformationalVersion).
/// </summary>
public static class AppVersion
{
    public static string Current { get; } =
        typeof(AppVersion).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
        ?? "0.0.0";
}
