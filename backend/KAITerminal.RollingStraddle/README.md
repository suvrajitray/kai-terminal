# KAI Terminal — Rolling Straddle

Standalone console app for running the rolling straddle/strangle strategy with real Upstox trades.

---

## Strategy

Sells an ATM straddle (or OTM strangle) at entry time and manages it through the day:

- **Entry:** Waits for `EntryTime`, checks India VIX, then sells CE + PE at market
- **Straddle vs strangle:** `StrikeOffset = 0` → ATM straddle. `StrikeOffset = N` → CE is N strikes above ATM, PE is N strikes below ATM
- **Roll:** If spot moves ≥ `RollThresholdPct`% from the entry spot, buys back both legs and re-enters a fresh position at the new ATM. Repeats up to `MaxRolls` times per day
- **Exit (first condition met):**
  - Time reaches `ExitTime`
  - P&L reaches `DailyMtmTargetPerLot × Lots` (profit target)
  - P&L falls below `-(DailyMtmStopLossPerLot × Lots)` (stop-loss)

---

## Configuration

Persistent defaults live in `appsettings.json`. You can override any value interactively at startup (press Enter to accept the default).

```json
{
  "ConnectionStrings": {
    "DefaultConnection": ""
  },
  "Strategy": {
    "Username": "suvrajit.ray@gmail.com",
    "BrokerName": "upstox",
    "Underlying": "NSE_INDEX|Nifty 50",
    "Exchange": "NFO",
    "Expiry": "",
    "Lots": 5,
    "LotSize": 65,
    "EntryTime": "09:35",
    "ExitTime": "15:05",
    "VixMaxThreshold": 20.0,
    "RollThresholdPct": 0.35,
    "MaxRolls": 3,
    "DailyMtmTargetPerLot": 2000,
    "DailyMtmStopLossPerLot": 3000,
    "StrikeOffset": 0,
    "CheckIntervalMs": 15000
  }
}
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `Username` | *(required)* | Email used to look up the Upstox token in the database |
| `BrokerName` | `upstox` | Broker name for the DB credentials lookup |
| `Underlying` | `NSE_INDEX\|Nifty 50` | Upstox instrument key for the index |
| `Exchange` | `NFO` | Options exchange (`NFO` for NSE, `BFO` for BSE) |
| `Expiry` | *(auto)* | Option expiry `yyyy-MM-dd`. Leave blank to auto-resolve the nearest upcoming expiry |
| `Lots` | `5` | Number of lots to trade |
| `LotSize` | `65` | Units per lot — see table below |
| `EntryTime` | `09:35` | IST time to enter (`HH:mm`) |
| `ExitTime` | `15:05` | IST hard exit time (`HH:mm`) |
| `VixMaxThreshold` | `20` | Skip entry if India VIX is above this. Set `0` to disable |
| `RollThresholdPct` | `0.35` | Spot move % from entry spot that triggers a roll |
| `MaxRolls` | `3` | Maximum rolls per day. Position is held unchanged after this |
| `DailyMtmTargetPerLot` | `2000` | Exit when P&L ≥ this × Lots (e.g. ₹2000 × 5 = ₹10,000) |
| `DailyMtmStopLossPerLot` | `3000` | Exit when loss ≥ this × Lots (e.g. ₹3000 × 5 = ₹15,000) |
| `StrikeOffset` | `0` | `0` = straddle (ATM). `N` = strangle (N strikes OTM each leg) |
| `CheckIntervalMs` | `15000` | Polling interval in milliseconds |

---

## Deployment

The server has a static IP whitelisted with Upstox (required by SEBI). **Do not run locally.**

This app is **not** a systemd service. It runs manually in a tmux session on days you want to trade.

### One-time server setup

Create `/etc/kaiterminal/rs.env` with just the DB connection string:

```bash
sudo cp /etc/kaiterminal/worker.env /etc/kaiterminal/rs.env
sudo nano /etc/kaiterminal/rs.env
# Keep only: ConnectionStrings__DefaultConnection=...
sudo chmod 600 /etc/kaiterminal/rs.env
sudo chown root:kaiterm /etc/kaiterminal/rs.env
```

The Upstox access token is fetched automatically from the database at startup — no manual token entry needed.

### Deploy a new build

```bash
./deploy/deploy.sh --rs
```

Publishes the project locally and rsyncs the output to `/opt/kaiterminal/rs/` on the server. Run whenever the code changes.

### Every trading day

```bash
./scripts/rs.sh
```

SSH-es into the server and attaches to (or creates) a tmux session named `rs`. On startup you are prompted for:

- **Expiry** — press Enter to auto-resolve the nearest upcoming expiry
- **Lots** — press Enter to use the appsettings value
- **MTM target per lot** — press Enter to use the appsettings value
- **MTM stop-loss per lot** — press Enter to use the appsettings value
- **Strike offset** — press Enter to use the appsettings value (0 = straddle)

```
Ctrl+B  D     ← detach from tmux (strategy keeps running)
Ctrl+C        ← graceful shutdown (closes open positions, then exits)
```

After detaching you can close your laptop. Reconnect any time by running `run-rolling-straddle.sh` again.

---

## P&L Tracking

P&L is fetched directly from the broker via `GetAllPositionsAsync()`. The app tracks the exact instrument tokens it traded and filters to only those, so other open positions in your account are not affected. On a day with rolls, closed legs retain their realized P&L in the broker response (`Quantity=0` but `Realised` is preserved).

---

## Order Execution

Orders are placed via the Upstox HFT endpoint (`api-hft.upstox.com`). Fill detection polls `GET /v2/order/retrieve-all` every 500ms until status reaches `complete`. If either leg fails to fill (rejection or 60-second timeout), any filled leg is immediately closed to avoid naked exposure, then the app returns to idle.

---

## Order Identification

All orders carry the tag `KAI_TERMINAL_RS`. Filter by this tag in the Upstox order book to distinguish strategy orders from manual trades.

---

## Switching Underlying

| Underlying | `Underlying` key | `Exchange` | `LotSize` | Expiry day |
|------------|-----------------|------------|-----------|------------|
| NIFTY | `NSE_INDEX\|Nifty 50` | `NFO` | `65` | Tuesday |
| BANKNIFTY | `NSE_INDEX\|Nifty Bank` | `NFO` | `30` | Wednesday |
| FINNIFTY | `NSE_INDEX\|Nifty Fin Service` | `NFO` | `60` | Tuesday |
| SENSEX | `BSE_INDEX\|SENSEX` | `BFO` | `20` | Friday |
| BANKEX | `BSE_INDEX\|BANKEX` | `BFO` | `30` | Monday |
