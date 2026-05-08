# KAI Terminal — Rolling Straddle

Standalone console app for validating the rolling straddle strategy with real Upstox trades at low quantity before building the full terminal feature.

---

## Strategy

Sells an ATM straddle (CE + PE) at entry time and manages it through the day:

- **Entry:** Waits for `EntryTime`, checks India VIX, then sells ATM CE + ATM PE at market
- **Roll:** If spot moves ≥ `RollThresholdPct`% from the entry spot, buys back both legs and re-enters a fresh straddle at the new ATM. Repeats up to `MaxRolls` times per day
- **Exit (first condition met):**
  - Time reaches `ExitTime`
  - P&L reaches `DailyMtmTarget` (profit target)
  - P&L falls below `-DailyMtmStopLoss` (stop-loss)

---

## Configuration

Edit `appsettings.json` before running. **`Strategy:Expiry` must be updated every week.**

```json
{
  "Upstox": {
    "AccessToken": ""
  },
  "Strategy": {
    "Underlying": "NSE_INDEX|Nifty 50",
    "Exchange": "NFO",
    "Expiry": "2026-05-12",
    "Lots": 5,
    "LotSize": 65,
    "EntryTime": "09:35",
    "ExitTime": "15:05",
    "VixMaxThreshold": 20.0,
    "RollThresholdPct": 0.3,
    "MaxRolls": 3,
    "DailyMtmTarget": 10000,
    "DailyMtmStopLoss": 15000,
    "CheckIntervalMs": 5000
  }
}
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `Underlying` | `NSE_INDEX\|Nifty 50` | Upstox instrument key for the index |
| `Exchange` | `NFO` | Options exchange (`NFO` for NSE, `BFO` for BSE) |
| `Expiry` | *(required)* | Option expiry date — format `yyyy-MM-dd`, e.g. `2026-05-12` |
| `Lots` | `5` | Number of lots to trade |
| `LotSize` | `65` | Units per lot — see table below |
| `EntryTime` | `09:35` | IST time to enter the straddle (`HH:mm`) |
| `ExitTime` | `15:05` | IST hard exit time (`HH:mm`) |
| `VixMaxThreshold` | `20` | Skip entry if India VIX is above this. Set `0` to disable |
| `RollThresholdPct` | `0.3` | Spot move % from entry spot that triggers a roll |
| `MaxRolls` | `3` | Maximum rolls per day. Position is held unchanged after this |
| `DailyMtmTarget` | `10000` | Exit when P&L reaches ₹10,000 |
| `DailyMtmStopLoss` | `15000` | Exit when loss reaches ₹15,000 |
| `CheckIntervalMs` | `5000` | Polling interval in milliseconds |

---

## Deployment

The server has a static IP whitelisted with Upstox (required by SEBI). **Do not run locally.**

This app is **not** a systemd service (unlike the API and Worker). It runs manually in a tmux session when needed.

### Server details

| Item | Value |
|------|-------|
| SSH | `ssh kaiterminal` |
| Repo | `/opt/kaiterminal/repo` |
| Project | `/opt/kaiterminal/repo/backend/KAITerminal.RollingStraddle` |

---

### Before the first run of the week

**1. Push your changes from local**

Commit and push any config changes (e.g. updated `Expiry`) from your local machine.

**2. Pull on the server**

```bash
ssh kaiterminal
cd /opt/kaiterminal/repo
git pull
```

**3. Update the expiry** (if not done via git)

```bash
nano /opt/kaiterminal/repo/backend/KAITerminal.RollingStraddle/appsettings.json
# Set "Expiry": "yyyy-MM-dd"  (Nifty expires on Tuesdays)
```

---

### Every trading day

**4. Run in a tmux session**

```bash
tmux new -s straddle
cd /opt/kaiterminal/repo/backend/KAITerminal.RollingStraddle
dotnet run --project .
# → Prompted: paste today's token and Enter (or just Enter to use appsettings value)

# Detach (session keeps running): Ctrl+B, D
# Re-attach later:                 tmux attach -t straddle
```

**To stop:** press `Ctrl+C` inside the tmux session. If positions are open, close them manually in the Upstox broker terminal — the app logs a reminder on shutdown.

---

## P&L Tracking

P&L is fetched directly from the broker via `GetAllPositionsAsync()` — no manual calculation. The app tracks the exact instrument tokens it traded and filters positions to only those tokens, so other open positions in your account are not affected.

On a day with rolls, closed legs retain their realized P&L in the broker's response (`Quantity=0` but `Realised` is preserved), so the total shown is always accurate.

---

## Order Execution

Orders are placed via the Upstox HFT endpoint (`api-hft.upstox.com`) for minimum latency. Fill detection polls `GET /v2/order/retrieve-all` every 500ms until the status reaches `complete`. For MARKET orders on NIFTY options this typically resolves on the first or second poll.

If either leg fails to fill (rejection or 60-second timeout), the app immediately closes any leg that did fill to avoid naked exposure, then returns to idle.

---

## Order Identification

All orders placed by this app carry the tag `KAI_TERMINAL_RS`. You can filter by this tag in the Upstox order book to distinguish strategy orders from manual trades.

---

## Switching Underlying

| Underlying | `Underlying` key | `Exchange` | `LotSize` | Expiry day |
|------------|-----------------|------------|-----------|------------|
| NIFTY | `NSE_INDEX\|Nifty 50` | `NFO` | `65` | Tuesday |
| BANKNIFTY | `NSE_INDEX\|Nifty Bank` | `NFO` | `30` | Wednesday |
| FINNIFTY | `NSE_INDEX\|Nifty Fin Service` | `NFO` | `60` | Tuesday |
| SENSEX | `BSE_INDEX\|SENSEX` | `BFO` | `20` | Friday |
| BANKEX | `BSE_INDEX\|BANKEX` | `BFO` | `30` | Monday |
