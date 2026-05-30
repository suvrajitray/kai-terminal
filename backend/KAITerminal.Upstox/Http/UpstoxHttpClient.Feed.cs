using System.Text.Json.Serialization;
using KAITerminal.Upstox.Exceptions;
using KAITerminal.Upstox.Models.WebSocket;

namespace KAITerminal.Upstox.Http;

internal sealed partial class UpstoxHttpClient
{
    public async Task<string> GetPortfolioStreamFeedUriAsync(
        IEnumerable<UpdateType>? updateTypes, CancellationToken ct = default)
    {
        var path = "/v2/feed/portfolio-stream-feed/authorize";

        if (updateTypes is not null)
        {
            var parts = updateTypes.Select(t => $"update_types={ToUpdateTypeString(t)}").ToList();
            if (parts.Count > 0)
                path += "?" + string.Join("&", parts);
        }

        var client = _factory.CreateClient("UpstoxApi");
        var response = await client.GetAsync(path, ct);
        var data = await HandleResponseAsync<AuthorizeResponse>(response, ct);
        return data.AuthorizedRedirectUri
            ?? throw new UpstoxException("Missing authorizedRedirectUri in portfolio stream feed authorize response");
    }

    internal static string ToUpdateTypeString(UpdateType t) => t switch
    {
        UpdateType.Order    => "order",
        UpdateType.Position => "position",
        UpdateType.Holding  => "holding",
        UpdateType.GttOrder => "gtt_order",
        _ => throw new ArgumentOutOfRangeException(nameof(t), t, null)
    };

    private sealed class AuthorizeResponse
    {
        [JsonPropertyName("authorizedRedirectUri")] public string? AuthorizedRedirectUri { get; init; }
    }
}
