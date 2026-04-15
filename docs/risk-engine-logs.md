# Risk Engine — Log Reference

Sample log output for each scenario. Timestamps are IST (log output is UTC+5:30 from Serilog).

`INF` = Information, `WRN` = Warning, `ERR` = Error.
Per-tick MTM status lines are `Debug` (silent by default) except when TSL is active.

---

## Session Startup

```
[09:15:01 INF] RiskWorker started — trading window 09:15–15:30 India Standard Time, poll every 10000ms, user refresh every 60000ms
[09:15:01 INF] Starting session — suvrajit.ray@gmail.com (Zerodha)
[09:15:01 INF] New trading day — resetting risk state for suvrajit.ray@gmail.com (Zerodha)
[09:15:02 INF] Positions loaded — suvrajit.ray@gmail.com (Zerodha) | 4 position(s) [all products]
[09:15:02 INF] Subscribing 2 instrument(s) — suvrajit.ray@gmail.com (Zerodha)
[09:15:02 INF] Streams live — suvrajit.ray@gmail.com (Zerodha)  watching 2 open instrument(s) [Intraday + Delivery]
[09:15:02 INF] Market open — risk engine active (09:15–15:30 India Standard Time)
```

---

## Quiet Trading (TSL off)

```
← nothing visible — all per-tick status lines are Debug →
```

---

## TSL Activates and Floor Keeps Rising

```
[10:42:18 INF] TSL ACTIVATED — suvrajit.ray@gmail.com (Zerodha)  floor locked at ₹+8,000
[10:42:18 INF] suvrajit.ray@gmail.com (Zerodha)  PnL ₹+8,450  |  Target ₹+15,000  |  TSL ₹+8,000  [Intraday + Delivery]
[10:44:55 INF] TSL RAISED — suvrajit.ray@gmail.com (Zerodha)  floor → ₹+9,000
[10:44:55 INF] suvrajit.ray@gmail.com (Zerodha)  PnL ₹+9,600  |  Target ₹+15,000  |  TSL ₹+9,000  [Intraday + Delivery]
[10:47:12 INF] TSL RAISED — suvrajit.ray@gmail.com (Zerodha)  floor → ₹+10,000
[10:47:12 INF] suvrajit.ray@gmail.com (Zerodha)  PnL ₹+10,800  |  Target ₹+15,000  |  TSL ₹+10,000  [Intraday + Delivery]
```

---

## TSL Floor Hit → Square-off

```
[10:52:03 INF] suvrajit.ray@gmail.com (Zerodha)  PnL ₹+9,750  |  Target ₹+15,000  |  TSL ₹+10,000  [Intraday + Delivery]
[10:52:04 WRN] TSL HIT — suvrajit.ray@gmail.com (Zerodha)  PnL ₹+9,750  ≤  floor ₹+10,000 — exiting all
[10:52:04 WRN] Square-off — suvrajit.ray@gmail.com (Zerodha) filter=All — 2 position(s) to exit (sells first)
[10:52:04 INF]   Exiting SHORT NIFTY2641320700PE qty=50 product=NRML [Zerodha / suvrajit.ray@gmail.com]
[10:52:05 INF]   Exiting SHORT NIFTY2641320800CE qty=50 product=NRML [Zerodha / suvrajit.ray@gmail.com]
[10:52:05 WRN] Square-off complete — suvrajit.ray@gmail.com (Zerodha) — 2 position(s) exited [All]
```

---

## Hard SL Hit → Square-off

```
[10:31:44 WRN] HARD SL HIT — suvrajit.ray@gmail.com (Zerodha)  PnL ₹-10,250  ≤  SL ₹-10,000 — exiting all
[10:31:44 WRN] Square-off — suvrajit.ray@gmail.com (Zerodha) filter=All — 2 position(s) to exit (sells first)
[10:31:44 INF]   Exiting SHORT NIFTY2641320700PE qty=50 product=NRML [Zerodha / suvrajit.ray@gmail.com]
[10:31:45 INF]   Exiting SHORT NIFTY2641320800CE qty=50 product=NRML [Zerodha / suvrajit.ray@gmail.com]
[10:31:45 WRN] Square-off complete — suvrajit.ray@gmail.com (Zerodha) — 2 position(s) exited [All]
```

---

## Target Hit → Square-off

```
[11:05:30 INF] TARGET HIT — suvrajit.ray@gmail.com (Zerodha)  PnL ₹+15,200  ≥  Target ₹+15,000 — exiting all
[11:05:30 WRN] Square-off — suvrajit.ray@gmail.com (Zerodha) filter=All — 2 position(s) to exit (sells first)
[11:05:30 INF]   Exiting SHORT NIFTY2641320700PE qty=50 product=NRML [Zerodha / suvrajit.ray@gmail.com]
[11:05:31 INF]   Exiting SHORT NIFTY2641320800CE qty=50 product=NRML [Zerodha / suvrajit.ray@gmail.com]
[11:05:31 WRN] Square-off complete — suvrajit.ray@gmail.com (Zerodha) — 2 position(s) exited [All]
```

---

## Auto Square-off (Time-Based)

```
[15:20:01 WRN] AUTO SQUARE-OFF — suvrajit.ray@gmail.com (Zerodha)  time 15:20 ≥ configured 15:20 — exiting all
[15:20:01 WRN] Square-off — suvrajit.ray@gmail.com (Zerodha) filter=All — 2 position(s) to exit (sells first)
[15:20:01 INF]   Exiting SHORT NIFTY2641320700PE qty=50 product=NRML [Zerodha / suvrajit.ray@gmail.com]
[15:20:02 INF]   Exiting SHORT NIFTY2641320800CE qty=50 product=NRML [Zerodha / suvrajit.ray@gmail.com]
[15:20:02 WRN] Square-off complete — suvrajit.ray@gmail.com (Zerodha) — 2 position(s) exited [All]
```

---

## AutoShift — Shift Triggered (shift 1 of 3)

```
[10:18:42 WRN] AutoShift SHIFTING — chain=NIFTY_2026-04-17_PE_22000 shift 1/3 | strike=22000 moving 1 OTM | isShiftedLeg=False [Zerodha / suvrajit.ray@gmail.com]
[10:18:42 INF] AutoShift placing orders — chain=NIFTY_2026-04-17_PE_22000 shift 0→1 | close=NIFTY2641322000PE qty=50 | open=NIFTY2641321800PE qty=50 [Zerodha / suvrajit.ray@gmail.com]
[10:18:43 INF] AutoShift close order placed — NIFTY2641322000PE qty=50 orderId=1234567890 [Zerodha / suvrajit.ray@gmail.com]
[10:18:43 INF] AutoShift waiting for fill — orderIds=1234567890 timeout=15s chain=NIFTY_2026-04-17_PE_22000 [suvrajit.ray@gmail.com]
[10:18:44 INF] AutoShift close order filled — orderIds=1234567890 chain=NIFTY_2026-04-17_PE_22000 [suvrajit.ray@gmail.com]
[10:18:44 INF] AutoShift open order placed — NIFTY2641321800PE qty=50 [Zerodha / suvrajit.ray@gmail.com]
[10:18:44 INF] AutoShift COMPLETE — chain=NIFTY_2026-04-17_PE_22000 shift 1/3 done | strike 22000→NIFTY2641321800PE | remaining=2 [Zerodha / suvrajit.ray@gmail.com]
```

---

## AutoShift — All Shifts Exhausted → Exit

```
[10:35:10 WRN] AutoShift EXHAUSTED — suvrajit.ray@gmail.com (Zerodha) | token=NIFTY2641321600PE has used all 3 shift(s) — placing exit order now
[10:35:11 INF] AutoShift EXHAUSTED exit order placed — NIFTY2641321600PE exited after 3/3 shift(s) [Zerodha / suvrajit.ray@gmail.com]
```

---

## Webhook — Order Fills

```
[10:18:42 INF] Zerodha webhook: actionable order update — status=COMPLETE user=suvrajit.ray@gmail.com orderId=2044302699251818496 symbol=NIFTY2641322000PE message=
```

Everything before and after (received, checksum, routing, done) is `Debug` — silent by default.

---

## Enabling Debug Logs

To see silent logs (per-tick MTM, webhook internals, position polls) add to `appsettings.json`:

```json
"Logging": {
  "LogLevel": {
    "Default": "Debug"
  }
}
```
