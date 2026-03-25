using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace KAITerminal.Api.Hubs;

[Authorize]
public sealed class RiskHub : Hub
{
    private readonly ILogger<RiskHub> _logger;

    public RiskHub(ILogger<RiskHub> logger) => _logger = logger;

    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        if (string.IsNullOrWhiteSpace(userId))
        {
            _logger.LogWarning("RiskHub: connection {Id} rejected — no user identifier in JWT", Context.ConnectionId);
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, userId);
        _logger.LogInformation("RiskHub: {UserId} connected — {Id}", userId, Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.UserIdentifier ?? "unknown";
        if (exception is null)
            _logger.LogInformation("RiskHub: {UserId} disconnected — {Id}", userId, Context.ConnectionId);
        else
            _logger.LogWarning(exception, "RiskHub: {UserId} disconnected with error — {Id}", userId, Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }
}
