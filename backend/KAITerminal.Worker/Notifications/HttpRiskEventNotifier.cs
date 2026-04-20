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
                    "Risk event POST returned {Status} for {UserId} ({Broker}) type={Type}",
                    (int)response.StatusCode, notification.UserId, notification.Broker, notification.Type);
        }
        catch (Exception ex)
        {
            // Critical events (square-off failures, SL hits) are logged as Error —
            // the trader may not be alerted at all if the notifier is down.
            var isCritical = notification.Type is RiskNotificationType.SquareOffFailed
                                               or RiskNotificationType.HardSlHit
                                               or RiskNotificationType.AutoShiftFailed;
            if (isCritical)
                _logger.LogError(ex,
                    "CRITICAL — failed to POST {Type} for {UserId} ({Broker}) — trader will NOT receive alert. Check API health.",
                    notification.Type, notification.UserId, notification.Broker);
            else
                _logger.LogWarning(ex,
                    "Failed to POST risk event {Type} for {UserId} ({Broker}) — frontend will not receive alert",
                    notification.Type, notification.UserId, notification.Broker);
        }
    }
}
