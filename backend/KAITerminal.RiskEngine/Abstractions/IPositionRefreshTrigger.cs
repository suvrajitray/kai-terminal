namespace KAITerminal.RiskEngine.Abstractions;

/// <summary>
/// Signals the position poll loop to run immediately for a given user+broker session,
/// without waiting for the next scheduled interval.
/// </summary>
public interface IPositionRefreshTrigger
{
    /// <param name="cacheKey">Format: <c>"{userId}::{brokerType}"</c></param>
    void RequestRefresh(string cacheKey);
}
