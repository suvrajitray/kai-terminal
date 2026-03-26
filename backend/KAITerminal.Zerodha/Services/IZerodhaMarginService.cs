namespace KAITerminal.Zerodha.Services;

public interface IZerodhaMarginService
{
    /// <summary>
    /// Calculates required margin for a basket of hypothetical orders without placing them.
    /// Calls <c>POST /margins/basket?consider_positions=true&amp;mode=compact</c>.
    /// </summary>
    Task<ZerodhaMarginResponse> GetRequiredMarginAsync(
        IEnumerable<ZerodhaMarginOrderItem> items, CancellationToken ct = default);
}

public sealed record ZerodhaMarginOrderItem(
    string TradingSymbol,
    string Exchange,
    string TransactionType,
    string Product,
    int    Quantity);

public sealed record ZerodhaMarginResponse(decimal RequiredMargin, decimal FinalMargin);
