using KAITerminal.Contracts.Domain;

namespace KAITerminal.Zerodha.Services;

public interface IZerodhaPositionService
{
    Task<IReadOnlyList<Position>> GetAllPositionsAsync(CancellationToken ct = default);
    Task<decimal> GetTotalMtmAsync(CancellationToken ct = default);
    Task ExitAllPositionsAsync(IReadOnlyCollection<string>? exchanges = null, CancellationToken ct = default);
    Task ExitPositionAsync(string instrumentToken, string product, CancellationToken ct = default);
    Task ConvertPositionAsync(string instrumentToken, string oldProduct, int quantity, CancellationToken ct = default);
}
