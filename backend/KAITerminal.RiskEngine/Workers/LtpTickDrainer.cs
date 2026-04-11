using System.Threading.Channels;
using KAITerminal.Contracts.Streaming;

namespace KAITerminal.RiskEngine.Workers;

/// <summary>Pure LTP tick drainer — no I/O, no side effects.</summary>
public static class LtpTickDrainer
{
    /// <summary>
    /// Drains all pending <see cref="LtpUpdate"/> ticks from <paramref name="reader"/>
    /// and returns the latest LTP per feed token.
    /// </summary>
    public static Dictionary<string, decimal> DrainLatest(ChannelReader<LtpUpdate> reader)
    {
        var latest = new Dictionary<string, decimal>(StringComparer.Ordinal);
        while (reader.TryRead(out var tick))
        {
            foreach (var (feedToken, ltp) in tick.Ltps)
                latest[feedToken] = ltp;
        }
        return latest;
    }
}
