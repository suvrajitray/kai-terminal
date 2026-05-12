using KAITerminal.RollingStraddle.Configuration;
using KAITerminal.RollingStraddle.Logic;
using KAITerminal.RollingStraddle.Models;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.RollingStraddle.Services;

internal sealed class RollingStraddleRunner : BackgroundService
{
    private readonly MarketDataFeed                 _feed;
    private readonly OrderExecutor                  _executor;
    private readonly PositionLedger                 _ledger;
    private readonly StrategyConfig                 _cfg;
    private readonly ILogger<RollingStraddleRunner> _log;
    private readonly IHostApplicationLifetime       _lifetime;

    private static readonly TimeZoneInfo Ist = TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
    private const string Sep = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

    public RollingStraddleRunner(
        MarketDataFeed                 feed,
        OrderExecutor                  executor,
        PositionLedger                 ledger,
        IOptions<StrategyConfig>       config,
        ILogger<RollingStraddleRunner> log,
        IHostApplicationLifetime       lifetime)
    {
        _feed     = feed;
        _executor = executor;
        _ledger   = ledger;
        _cfg      = config.Value;
        _log      = log;
        _lifetime = lifetime;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_cfg.Expiry))
        {
            _log.LogError("[CONFIG] Strategy:Expiry is not set. Update appsettings.json and restart.");
            _lifetime.StopApplication();
            return;
        }

        PrintBanner();

        var state = StraddleState.Empty;

        try
        {
            while (!ct.IsCancellationRequested)
            {
                try
                {
                    var spot = await _feed.FetchSpotAsync(ct);
                    if (spot <= 0)
                    {
                        _log.LogWarning("[FEED ] Spot unavailable — retrying in {Ms}ms", _cfg.CheckIntervalMs);
                        await Delay(ct);
                        continue;
                    }

                    var (pnl, ceLtp, peLtp) = state.HasOpenLegs
                        ? await _ledger.FetchAsync(state, ct)
                        : (0m, 0m, 0m);

                    var snapshot = new MarketSnapshot(spot, pnl, ceLtp, peLtp, NowIst());
                    var decision = StrategyEngine.Evaluate(state, snapshot, _cfg);

                    switch (decision)
                    {
                        case StrategyDecision.WaitForEntry w:
                            _log.LogInformation(
                                "[IDLE ] Entry at {Time} — {Min}m {Sec}s remaining  |  Spot {Spot:F2}",
                                _cfg.EntryTime, (int)w.Remaining.TotalMinutes, w.Remaining.Seconds, spot);
                            break;

                        case StrategyDecision.Enter:
                            state = await HandleEntryAsync(spot, state, ct);
                            break;

                        case StrategyDecision.Roll r:
                            state = await HandleRollAsync(r, spot, state, snapshot, ct);
                            break;

                        case StrategyDecision.HoldMaxRolls m:
                            _log.LogWarning(
                                "[ROLL ] Max rolls ({Max}) reached — holding  |  Spot {Spot:F2}  Move {Move:+0.00;-0.00}%",
                                _cfg.MaxRolls, spot, m.MovePct);
                            LogLive(snapshot, state.EntrySpot);
                            break;

                        case StrategyDecision.Hold:
                            LogLive(snapshot, state.EntrySpot);
                            break;

                        case StrategyDecision.Exit e:
                            await HandleExitAsync(e.Reason, state, snapshot, ct);
                            return;
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _log.LogError(ex, "[ERROR] Unhandled exception — retrying in {Ms}ms", _cfg.CheckIntervalMs);
                }

                await Delay(ct);
            }
        }
        catch (OperationCanceledException)
        {
            if (state.HasOpenLegs)
                await GracefulShutdownAsync(state);
            else
                _log.LogInformation("[EXIT ] Shutdown — no open positions");
        }

        _lifetime.StopApplication();
    }

    // ── Entry ─────────────────────────────────────────────────────────────────

    private async Task<StraddleState> HandleEntryAsync(
        decimal spot, StraddleState current, CancellationToken ct)
    {
        if (_cfg.VixMaxThreshold > 0)
        {
            var vix = await _feed.FetchVixAsync(ct);
            if (vix <= 0)
            {
                _log.LogWarning("[VIX  ] Unavailable — blocking entry as precaution");
                return current;
            }
            if (vix > _cfg.VixMaxThreshold)
            {
                _log.LogWarning("[VIX  ] {Vix:F1} exceeds threshold {Max} — skipping entry", vix, _cfg.VixMaxThreshold);
                return current;
            }
            _log.LogInformation("[VIX  ] {Vix:F1} — OK (threshold {Max})", vix, _cfg.VixMaxThreshold);
        }

        _log.LogInformation("[ENTRY] Entry window open  |  Spot {Spot:F2}", spot);
        return await EnterStraddleAsync(spot, current, ct);
    }

    private async Task<StraddleState> EnterStraddleAsync(
        decimal spot, StraddleState current, CancellationToken ct)
    {
        var atm = await _feed.FindAtmAsync(spot, ct);
        if (atm is null) return current;

        var (strike, ceKey, peKey) = atm.Value;
        var qty = _cfg.Lots * _cfg.LotSize;

        _log.LogInformation("[ENTRY] ATM strike {Strike}  |  Spot {Spot:F2}", strike, spot);
        _log.LogInformation("[ENTRY] Placing straddle — SELL CE {Ce}  SELL PE {Pe}  Qty {Qty}", ceKey, peKey, qty);

        var ceOrderId = await _executor.SellMarketAsync(ceKey, qty, ct);
        var peOrderId = await _executor.SellMarketAsync(peKey, qty, ct);
        _log.LogInformation("[ENTRY] Orders sent — CE {CeId}  PE {PeId} — awaiting fills", ceOrderId, peOrderId);

        var ceFill = await _executor.WaitForFillAsync("CE", ceOrderId, ct);
        var peFill = await _executor.WaitForFillAsync("PE", peOrderId, ct);

        if (ceFill <= 0 || peFill <= 0)
        {
            _log.LogError(
                "[ENTRY] Fill incomplete (CE=₹{Ce:F2} PE=₹{Pe:F2}) — closing any filled leg to avoid naked exposure",
                ceFill, peFill);
            if (ceFill > 0) { var id = await _executor.BuyMarketAsync(ceKey, qty, ct); await _executor.WaitForFillAsync("CE emergency close", id, ct); }
            if (peFill > 0) { var id = await _executor.BuyMarketAsync(peKey, qty, ct); await _executor.WaitForFillAsync("PE emergency close", id, ct); }
            return current;
        }

        _log.LogInformation(
            "[ENTRY] Straddle active — CE ₹{Ce:F2}  PE ₹{Pe:F2}  Combined ₹{Total:F2}  EntrySpot {Spot:F2}",
            ceFill, peFill, ceFill + peFill, spot);

        return current with
        {
            CeLeg        = new Leg(ceKey, qty),
            PeLeg        = new Leg(peKey, qty),
            EntrySpot    = spot,
            TradedTokens = current.TradedTokens.Add(ceKey).Add(peKey)
        };
    }

    // ── Roll ──────────────────────────────────────────────────────────────────

    private async Task<StraddleState> HandleRollAsync(
        StrategyDecision.Roll r, decimal spot, StraddleState state, MarketSnapshot snapshot, CancellationToken ct)
    {
        _log.LogWarning(Sep);
        _log.LogWarning(
            "  ROLL #{N}  |  Spot {Spot:F2}  Move {Move:+0.00;-0.00}%  from {Entry:F2}",
            r.RollNumber, spot, r.MovePct, state.EntrySpot);
        _log.LogWarning(
            "  CE ₹{Ce:F2}  PE ₹{Pe:F2}  |  P&L at roll {Sign}₹{Pnl:N0}",
            snapshot.CeLtp, snapshot.PeLtp,
            PnlSign(snapshot.Pnl), Math.Abs(snapshot.Pnl));
        _log.LogWarning(Sep);

        _log.LogInformation("[ROLL ] Closing current legs...");
        var closed = await CloseLegsAsync(state, ct);

        _log.LogInformation("[ROLL ] Opening new straddle at Spot {Spot:F2}", spot);
        var result = await EnterStraddleAsync(spot, closed with { RollCount = closed.RollCount + 1 }, ct);

        _log.LogInformation(Sep);

        return result;
    }

    // ── Close / Exit ──────────────────────────────────────────────────────────

    private async Task<StraddleState> CloseLegsAsync(StraddleState state, CancellationToken ct)
    {
        if (state.CeLeg is { } ce)
        {
            _log.LogInformation("[CLOSE] BUY CE {Token}  Qty {Qty}", ce.Token, ce.Qty);
            var id = await _executor.BuyMarketAsync(ce.Token, ce.Qty, ct);
            await _executor.WaitForFillAsync("CE", id, ct);
        }
        if (state.PeLeg is { } pe)
        {
            _log.LogInformation("[CLOSE] BUY PE {Token}  Qty {Qty}", pe.Token, pe.Qty);
            var id = await _executor.BuyMarketAsync(pe.Token, pe.Qty, ct);
            await _executor.WaitForFillAsync("PE", id, ct);
        }
        return state with { CeLeg = null, PeLeg = null };
    }

    private async Task HandleExitAsync(
        string reason, StraddleState state, MarketSnapshot snapshot, CancellationToken ct)
    {
        _log.LogInformation("[EXIT ] {Reason}  |  P&L {Sign}₹{Pnl:N0}",
            reason, PnlSign(snapshot.Pnl), Math.Abs(snapshot.Pnl));

        _log.LogInformation("[EXIT ] Cancelling pending orders...");
        await _executor.CancelAllPendingAsync(ct);

        _log.LogInformation("[EXIT ] Closing all open legs...");
        await CloseLegsAsync(state, ct);

        var (finalPnl, _, _) = await _ledger.FetchAsync(state, ct);

        _log.LogInformation(Sep);
        _log.LogInformation("  SESSION COMPLETE");
        _log.LogInformation("  Exit reason  :  {Reason}", reason);
        _log.LogInformation("  Total rolls  :  {Rolls}", state.RollCount);
        _log.LogInformation("  Final P&L    :  {Sign}₹{Pnl:N0}", PnlSign(finalPnl), Math.Abs(finalPnl));
        _log.LogInformation(Sep);

        _lifetime.StopApplication();
    }

    // ── Graceful shutdown ─────────────────────────────────────────────────────

    private async Task GracefulShutdownAsync(StraddleState state)
    {
        _log.LogWarning("[EXIT ] Ctrl+C — checking broker positions before shutdown...");
        try
        {
            var (ceOpen, peOpen) = await _ledger.CheckLegsOpenAsync(state, CancellationToken.None);

            if (!ceOpen && !peOpen)
            {
                _log.LogInformation("[EXIT ] Positions already closed — shutdown clean");
                return;
            }

            _log.LogWarning(Sep);
            _log.LogWarning("  GRACEFUL SHUTDOWN — closing open position(s)");
            _log.LogWarning(Sep);

            await _executor.CancelAllPendingAsync(CancellationToken.None);

            if (ceOpen && state.CeLeg is { } ce)
            {
                _log.LogInformation("[CLOSE] BUY CE {Token}  Qty {Qty}", ce.Token, ce.Qty);
                var id = await _executor.BuyMarketAsync(ce.Token, ce.Qty, CancellationToken.None);
                await _executor.WaitForFillAsync("CE shutdown", id, CancellationToken.None);
            }
            if (peOpen && state.PeLeg is { } pe)
            {
                _log.LogInformation("[CLOSE] BUY PE {Token}  Qty {Qty}", pe.Token, pe.Qty);
                var id = await _executor.BuyMarketAsync(pe.Token, pe.Qty, CancellationToken.None);
                await _executor.WaitForFillAsync("PE shutdown", id, CancellationToken.None);
            }

            _log.LogInformation(Sep);
            _log.LogInformation("  SHUTDOWN COMPLETE — positions closed");
            _log.LogInformation(Sep);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "[ERROR] Graceful shutdown failed — close positions manually in broker terminal");
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void LogLive(MarketSnapshot snapshot, decimal entrySpot)
    {
        var move = entrySpot > 0 ? (snapshot.Spot - entrySpot) / entrySpot * 100m : 0m;
        _log.LogInformation(
            "[LIVE ] Spot {Spot:F2} ({Move:+0.00;-0.00}%)  |  CE {Ce:F2}  PE {Pe:F2}  |  P&L {Sign}₹{Pnl:N0}",
            snapshot.Spot, move, snapshot.CeLtp, snapshot.PeLtp,
            PnlSign(snapshot.Pnl), Math.Abs(snapshot.Pnl));
    }

    private void PrintBanner()
    {
        _log.LogInformation(Sep);
        _log.LogInformation("  KAI Terminal — Rolling Straddle");
        _log.LogInformation("  Underlying   :  {U}", _cfg.Underlying);
        _log.LogInformation("  Expiry       :  {E}", _cfg.Expiry);
        _log.LogInformation("  Size         :  {L} lots x {Ls} = {Total} units/leg",
            _cfg.Lots, _cfg.LotSize, _cfg.Lots * _cfg.LotSize);
        _log.LogInformation("  Entry / Exit :  {Entry}  →  {Exit}", _cfg.EntryTime, _cfg.ExitTime);
        _log.LogInformation("  Roll         :  {Roll}%  max {MaxRolls}x", _cfg.RollThresholdPct, _cfg.MaxRolls);
        _log.LogInformation("  Target / SL  :  +₹{Target:N0}  /  -₹{Sl:N0}", _cfg.DailyMtmTarget, _cfg.DailyMtmStopLoss);
        _log.LogInformation("  VIX filter   :  {Vix}",
            _cfg.VixMaxThreshold > 0 ? $"skip if VIX > {_cfg.VixMaxThreshold}" : "disabled");
        _log.LogInformation(Sep);
    }

    private static string PnlSign(decimal pnl) => pnl >= 0 ? "+" : "-";

    private static TimeSpan NowIst() =>
        TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, Ist).TimeOfDay;

    private Task Delay(CancellationToken ct) =>
        Task.Delay(_cfg.CheckIntervalMs, ct);
}
