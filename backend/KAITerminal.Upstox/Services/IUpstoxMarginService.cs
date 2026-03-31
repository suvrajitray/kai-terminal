using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

public interface IUpstoxMarginService
{
    Task<MarginResponse> GetRequiredMarginAsync(
        IEnumerable<MarginOrderItem> items, CancellationToken ct = default);
}
