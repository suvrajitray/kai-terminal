using KAITerminal.Contracts.Streaming;
using KAITerminal.MarketData.Protos;

namespace KAITerminal.MarketData.Streaming;

/// <summary>
/// Decodes Upstox binary market feed messages (protobuf) into LTP updates.
/// </summary>
internal static class ProtobufFeedDecoder
{
    /// <summary>
    /// Parses <paramref name="count"/> bytes from <paramref name="buffer"/> as an Upstox
    /// <c>FeedResponse</c> protobuf message and extracts the LTP for each instrument.
    /// </summary>
    /// <returns>
    /// An <see cref="LtpUpdate"/> when at least one LTP was extracted; <c>null</c> otherwise.
    /// </returns>
    public static LtpUpdate? Decode(byte[] buffer, int count)
    {
        var proto = FeedResponse.Parser.ParseFrom(buffer, 0, count);

        if (proto.Feeds.Count == 0) return null;

        var ltps = new Dictionary<string, decimal>(proto.Feeds.Count);
        foreach (var kv in proto.Feeds)
        {
            var ltp = ExtractLtp(kv.Value);
            if (ltp.HasValue)
                ltps[kv.Key] = ltp.Value;
        }

        return ltps.Count > 0 ? new LtpUpdate(ltps) : null;
    }

    private static decimal? ExtractLtp(Feed feed) => feed.FeedUnionCase switch
    {
        Feed.FeedUnionOneofCase.Ltpc                                             => (decimal?)feed.Ltpc.Ltp,
        Feed.FeedUnionOneofCase.FullFeed when feed.FullFeed.MarketFF is not null => (decimal?)feed.FullFeed.MarketFF.Ltpc.Ltp,
        Feed.FeedUnionOneofCase.FullFeed                                         => (decimal?)feed.FullFeed.IndexFF?.Ltpc.Ltp,
        Feed.FeedUnionOneofCase.FirstLevelWithGreeks                             => (decimal?)feed.FirstLevelWithGreeks.Ltpc.Ltp,
        _                                                                        => null
    };
}
