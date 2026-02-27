using System.Security.Cryptography;
using System.Text;

namespace KAITerminal.Broker.Util;

public static class KiteChecksum
{
  public static string Generate(
      string apiKey,
      string requestToken,
      string apiSecret)
  {
    var raw = apiKey + requestToken + apiSecret;

    using var sha = SHA256.Create();
    var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(raw));

    return BitConverter.ToString(bytes)
        .Replace("-", "")
        .ToLower();
  }
}
