using System.Text.RegularExpressions;
using Expensy.Data;

namespace Expensy.Services;

/// <summary>
/// Stores receipt/expense photos as plain files in the data directory.
/// File names are generated server-side (GUID + extension detected from the file's bytes),
/// so nothing the client sends ends up in a path.
/// </summary>
public sealed partial class PhotoStore(AppPaths paths)
{
    public const long MaxBytes = 10 * 1024 * 1024;

    private static readonly Dictionary<string, string> ContentTypes = new()
    {
        [".jpg"] = "image/jpeg",
        [".png"] = "image/png",
        [".webp"] = "image/webp",
        [".heic"] = "image/heic",
        [".gif"] = "image/gif",
    };

    /// <summary>Allowed extensions of the uploaded file name → the type its bytes must actually be.</summary>
    private static readonly Dictionary<string, string> AllowedUploadExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = ".jpg", [".jpeg"] = ".jpg", [".png"] = ".png", [".webp"] = ".webp",
        [".heic"] = ".heic", [".heif"] = ".heic", [".gif"] = ".gif",
    };

    [GeneratedRegex(@"^[0-9a-f]{32}\.(jpg|png|webp|heic|gif)$")]
    private static partial Regex ValidName();

    /// <summary>
    /// Saves the upload and returns the stored file name, or null if it isn't a supported image.
    /// Both must agree: the file name's extension is on the allow-list, and the file's first bytes are that format.
    /// </summary>
    public async Task<string?> SaveAsync(IFormFile file, CancellationToken ct)
    {
        if (file.Length is 0 or > MaxBytes) return null;
        if (!AllowedUploadExtensions.TryGetValue(Path.GetExtension(file.FileName), out var expected)) return null;

        var header = new byte[16];
        await using (var peek = file.OpenReadStream())
        {
            await peek.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
        }

        var ext = DetectExtension(header);
        if (ext is null || ext != expected) return null;

        var name = Guid.NewGuid().ToString("N") + ext;
        await using var target = File.Create(Path.Combine(paths.PhotosDir, name));
        await file.CopyToAsync(target, ct);
        return name;
    }

    public void Delete(string? name)
    {
        if (name is null || !ValidName().IsMatch(name)) return;
        var path = Path.Combine(paths.PhotosDir, name);
        if (File.Exists(path)) File.Delete(path);
    }

    /// <summary>Returns the full path and content type for a stored photo, or null if the name is invalid / missing.</summary>
    public (string Path, string ContentType)? Find(string name)
    {
        if (!ValidName().IsMatch(name)) return null;
        var path = Path.Combine(paths.PhotosDir, name);
        return File.Exists(path) ? (path, ContentTypes[Path.GetExtension(name)]) : null;
    }

    private static string? DetectExtension(ReadOnlySpan<byte> b)
    {
        if (b is [0xFF, 0xD8, 0xFF, ..]) return ".jpg";
        if (b is [0x89, (byte)'P', (byte)'N', (byte)'G', ..]) return ".png";
        if (b is [(byte)'G', (byte)'I', (byte)'F', (byte)'8', ..]) return ".gif";
        if (b is [(byte)'R', (byte)'I', (byte)'F', (byte)'F', _, _, _, _, (byte)'W', (byte)'E', (byte)'B', (byte)'P', ..]) return ".webp";
        if (b is [_, _, _, _, (byte)'f', (byte)'t', (byte)'y', (byte)'p', ..]) return ".heic";
        return null;
    }
}
