using System.Security.Cryptography;

namespace Expensy.Services;

/// <summary>
/// Password hashing with PBKDF2-SHA256 (built into .NET, no extra packages).
/// Stored format: "pbkdf2-sha256$&lt;iterations&gt;$&lt;salt base64&gt;$&lt;hash base64&gt;", so the iteration count
/// can be raised later without breaking existing passwords.
/// </summary>
public static class Passwords
{
    private const int Iterations = 600_000; // OWASP recommendation for PBKDF2-SHA256
    private const int SaltBytes = 16;
    private const int HashBytes = 32;
    public const int MinLength = 8;
    public const int MaxLength = 64;

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashBytes);
        return $"pbkdf2-sha256${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string stored)
    {
        var parts = stored.Split('$');
        if (parts is not ["pbkdf2-sha256", var iter, var saltText, var hashText] || !int.TryParse(iter, out var iterations))
            return false;

        var expected = Convert.FromBase64String(hashText);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, Convert.FromBase64String(saltText), iterations,
            HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    /// <summary>A hash of a random password, used to spend the same time verifying when the username doesn't exist.</summary>
    public static readonly string Dummy = Hash(Convert.ToBase64String(RandomNumberGenerator.GetBytes(16)));
}
