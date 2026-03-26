using KAITerminal.MarketData.Models;
using KAITerminal.MarketData.Services;

namespace KAITerminal.Api.Endpoints;

public static class ChartEndpoints
{
    // Default lookback per interval — NSE/BSE INDEX instruments only support the historical endpoint,
    // so all intervals (including sub-day ones) use GetHistoricalCandlesAsync with these date ranges.
    private static DateOnly DefaultFromDate(CandleInterval interval, DateOnly to) => interval switch
    {
        CandleInterval.OneMinute    => to.AddDays(-2),
        CandleInterval.ThirtyMinute => to.AddDays(-30),
        CandleInterval.OneDay       => to.AddYears(-1),
        CandleInterval.OneWeek      => to.AddYears(-3),
        CandleInterval.OneMonth     => to.AddYears(-5),
        _                           => to.AddYears(-1)
    };

    public static IEndpointRouteBuilder MapChartEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/upstox/charts").RequireAuthorization();

        group.MapGet("/candles", async (
            string instrumentKey,
            string interval,
            string? from,
            string? to,
            IChartDataService charts,
            CancellationToken ct) =>
        {
            if (!Enum.TryParse<CandleInterval>(interval, ignoreCase: true, out var candleInterval))
                return Results.BadRequest(new { message = $"Invalid interval: {interval}" });

            var toDate   = string.IsNullOrEmpty(to)   ? DateOnly.FromDateTime(DateTime.Today) : DateOnly.Parse(to);
            var fromDate = string.IsNullOrEmpty(from) ? DefaultFromDate(candleInterval, toDate) : DateOnly.Parse(from);
            var candles  = await charts.GetHistoricalCandlesAsync(instrumentKey, candleInterval, fromDate, toDate, ct);
            return Results.Ok(candles);
        });

        group.MapGet("/search", async (
            string q,
            IChartDataService charts,
            CancellationToken ct) =>
        {
            if (q.Length < 2)
                return Results.Ok(Array.Empty<object>());

            var results = await charts.SearchInstrumentsAsync(q, ct);
            return Results.Ok(results);
        });

        return app;
    }
}
