using Expensy.Data;

namespace Expensy.Services;

/// <summary>
/// Daily CSV backup of all users' expenses to &lt;data dir&gt;/backups (EXPENSY_BACKUP = how many days to keep; 0 = off).
///
/// Runs at midnight (server time zone, TZ). If the server was off at midnight, the day's backup is made at startup.
/// Files are named expensy-yyyy-MM-dd.csv; older ones beyond the limit are deleted.
/// </summary>
public sealed class BackupService(Database db, AppPaths paths, IConfiguration config, ILogger<BackupService> logger)
    : BackgroundService
{
    private const string Prefix = "expensy-";

    private int Keep => Math.Max(0, config.GetNumber("BACKUP", logger));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (Keep == 0) return;
        logger.LogInformation("Daily backups to {Dir}, keeping the last {Keep}", paths.BackupsDir, Keep);

        while (!stoppingToken.IsCancellationRequested)
        {
            try { BackUpIfMissing(DateTime.Now); }
            catch (Exception ex) { logger.LogError(ex, "Backup failed"); } // try again tomorrow

            var untilMidnight = DateTime.Today.AddDays(1) - DateTime.Now;
            try { await Task.Delay(untilMidnight + TimeSpan.FromSeconds(5), stoppingToken); }
            catch (TaskCanceledException) { return; }
        }
    }

    /// <summary>Writes today's backup unless it already exists, then removes the oldest ones.</summary>
    public void BackUpIfMissing(DateTime now)
    {
        var file = Path.Combine(paths.BackupsDir, $"{Prefix}{now:yyyy-MM-dd}.csv");
        if (!File.Exists(file))
        {
            using var c = db.Open();
            var csv = CsvExport.Build(c, new CsvExport.Filter(UserId: null, All: true), CsvFormat.English,
                TimeZoneInfo.Local, includeUser: true);
            File.WriteAllBytes(file + ".tmp", csv); // write fully, then rename, so a crash never leaves half a file
            File.Move(file + ".tmp", file, overwrite: true);
            logger.LogInformation("Backup written: {File}", file);
        }

        var old = Directory.GetFiles(paths.BackupsDir, $"{Prefix}*.csv")
            .OrderDescending() // names sort by date
            .Skip(Keep);
        foreach (var path in old) File.Delete(path);
    }
}
