using System.Runtime.InteropServices;

namespace Expensy.Data;

/// <summary>Where Expensy keeps its state. Everything lives under one data directory (a Docker volume).</summary>
public sealed class AppPaths
{
    public string DataDir { get; }
    public string DatabaseFile => Path.Combine(DataDir, "expensy.db");
    public string PhotosDir => Path.Combine(DataDir, "photos");
    public string BackupsDir => Path.Combine(DataDir, "backups");

    /// <summary>Creates the data directories. Throws <see cref="DataDirNotWritableException"/> if the app can't write there.</summary>
    public AppPaths(string dataDir)
    {
        DataDir = Path.GetFullPath(dataDir);
        try
        {
            Directory.CreateDirectory(DataDir);
            Directory.CreateDirectory(PhotosDir);
            Directory.CreateDirectory(BackupsDir);
            // Existing directories don't prove we can write, so also try a file.
            var probe = Path.Combine(DataDir, ".write-test");
            File.WriteAllText(probe, "");
            File.Delete(probe);
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException)
        {
            throw new DataDirNotWritableException(DataDir, CurrentUserIds(), ex);
        }
    }

    /// <summary>"1000:1000" — the user and group the process runs as (Linux/macOS).</summary>
    private static string CurrentUserIds() =>
        OperatingSystem.IsWindows() ? Environment.UserName : $"{GetUid()}:{GetGid()}";

    [DllImport("libc", EntryPoint = "getuid")]
    private static extern uint GetUid();

    [DllImport("libc", EntryPoint = "getgid")]
    private static extern uint GetGid();
}

/// <summary>The data directory exists but the app's user can't write to it — usually a host directory owned by someone else.</summary>
public sealed class DataDirNotWritableException(string dataDir, string userIds, Exception inner) : Exception(
    $"""
    Expensy can't write to its data directory {dataDir} ({inner.Message}).
    The app runs as {userIds}. Either make the mounted host directory writable for that user:
        sudo chown -R {userIds} /path/on/host
    or set PUID / PGID in docker-compose to the directory's owner.
    """, inner);
