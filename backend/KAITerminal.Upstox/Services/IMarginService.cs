using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

public interface IMarginService
{
    Task<MarginResponse> GetRequiredMarginAsync(
        IEnumerable<MarginOrderItem> items, CancellationToken ct = default);
}
