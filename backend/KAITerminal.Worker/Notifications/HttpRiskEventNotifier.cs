using System.Net.Http.Json;
using KAITerminal.Contracts.Notifications;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Worker.Notifications;

internal sealed class HttpRiskEventNotifier : IRiskEventNotifier
{
    private readonly HttpClient _http;
    private readonly ILogger<HttpRiskEventNotifier> _logger;

    public HttpRiskEventNotifier(
        IHttpClientFactory factory,
        ILogger<HttpRiskEventNotifier> logger)
    {
        _http   = factory.CreateClient("RiskNotify");
        _logger = logger;
    }

    public async Task NotifyAsync(RiskNotification notification, CancellationToken ct = default)
    {
        try
        {
            using var response = await _http.PostAsJsonAsync(
                "/api/internal/risk-event", notification, ct);

            if (!response.IsSuccessStatusCode)
                _logger.LogWarning(
                    "Risk event POST returned {Status} for {UserId} ({Type})",
                    (int)response.StatusCode, notification.UserId, notification.Type);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Failed to POST risk event {Type} for {UserId} — frontend will not receive alert",
                notification.Type, notification.UserId);
        }
    }
}
