using KAITerminal.Types;

namespace KAITerminal.Broker.Interfaces;

public interface ITokenGenerator
{
  Task<AccessToken> GenerateAccessTokenAsync(
   string apiKey,
   string apiSecret,
   string requestToken,
   CancellationToken ct = default);

}
