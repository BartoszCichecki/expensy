using System.Net.Sockets;
using IPNetwork = System.Net.IPNetwork;

namespace Expensy.Web;

/// <summary>
/// Which reverse proxies may set X-Forwarded-For / X-Forwarded-Proto (configured with EXPENSY_TRUSTED_PROXIES).
/// Headers from anyone else are ignored, otherwise a client could fake its IP (dodging the login limit)
/// or pretend the connection is HTTPS.
/// </summary>
public static class TrustedProxies
{
    /// <summary>Loopback + private ranges: a proxy on the same host, a Docker network, Tailscale serve, a LAN.</summary>
    private static readonly string[] Defaults =
        ["127.0.0.0/8", "::1/128", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7"];

    /// <summary>Parses "10.0.0.0/8, 1.2.3.4" (single IPs allowed); empty → <see cref="Defaults"/>.</summary>
    public static IEnumerable<IPNetwork> Parse(string? configured)
    {
        var entries = string.IsNullOrWhiteSpace(configured)
            ? Defaults
            : configured.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var entry in entries)
        {
            var cidr = entry.Contains('/') ? entry : entry + (entry.Contains(':') ? "/128" : "/32");
            var network = IPNetwork.Parse(cidr);
            yield return network;

            // Kestrel may report IPv4 clients as IPv4-mapped IPv6 (::ffff:10.0.0.5), so trust that form too.
            if (network.BaseAddress.AddressFamily == AddressFamily.InterNetwork)
                yield return new IPNetwork(network.BaseAddress.MapToIPv6(), network.PrefixLength + 96);
        }
    }
}
