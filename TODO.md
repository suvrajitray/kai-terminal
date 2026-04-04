# KAI Terminal — TODO

Items that require manual steps, deferred implementation, or future work.
For the frontend enhancement backlog, see `frontend/TODO.md`.

---

## Multi-broker Integration — Pending

### DB (Manual SQL on Neon)

These changes cannot be applied automatically because EF uses `EnsureCreatedAsync()` (not migrations).
Run the following on the Neon console or a `psql` session:

```sql
-- 1. Add BrokerType column to UserRiskConfigs
ALTER TABLE "UserRiskConfigs"
  ADD COLUMN IF NOT EXISTS "BrokerType" text NOT NULL DEFAULT 'upstox';

-- 2. Drop old unique index on Username only
DROP INDEX IF EXISTS "ix_userriskconfigs_username";

-- 3. Create new unique index on (Username, BrokerType)
CREATE UNIQUE INDEX IF NOT EXISTS "ix_userriskconfigs_username_brokertype"
  ON "UserRiskConfigs" ("Username", "BrokerType");
```

> Without step 1, `DbUserTokenSource` will fail to join `BrokerCredentials` on `BrokerType`.
> Without steps 2–3, inserting a second broker config for the same user will be rejected.

```sql
-- 4. Add auto square-off columns to UserTradingSettings
ALTER TABLE "UserTradingSettings"
  ADD COLUMN IF NOT EXISTS "AutoSquareOffEnabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "AutoSquareOffTime" varchar(5) NOT NULL DEFAULT '15:20';
```

> Without this, the auto square-off feature silently does nothing — `DbUserTokenSource` reads a null `ts` and defaults `AutoSquareOffEnabled = false`.

```sql
-- 5. Create IvSnapshots table (IV Rank historical data)
CREATE TABLE IF NOT EXISTS "IvSnapshots" (
    "Id"         serial      PRIMARY KEY,
    "Date"       date        NOT NULL,
    "Underlying" text        NOT NULL,
    "Expiry"     text        NOT NULL,
    "AtmStrike"  numeric     NOT NULL,
    "AtmIv"      numeric     NOT NULL,
    "AtmCallLtp" numeric     NOT NULL,
    "AtmPutLtp"  numeric     NOT NULL,
    "SpotPrice"  numeric     NOT NULL,
    "CreatedAt"  timestamp   NOT NULL,
    CONSTRAINT "uq_ivsnapshots_date_underlying_expiry"
        UNIQUE ("Date", "Underlying", "Expiry")
);
CREATE INDEX IF NOT EXISTS "ix_ivsnapshots_underlying_date"
    ON "IvSnapshots" ("Underlying", "Date" DESC);
```

> Without this, `IvSnapshotJob` will fail to save snapshots and the IVR widget will never show data.

---

### Backend

- [ ] **`KAITerminal.Console` — register `IBrokerClientFactory`**
  The Console host still uses `UpstoxClient` directly via `SingleUserTokenSource`. If the Console ever needs to run against Zerodha, `IBrokerClientFactory` needs to be registered in its `Program.cs` the same way as the Worker.

- [ ] **`KiteTickerStreamer` — full KiteTicker implementation**
  `backend/KAITerminal.Zerodha/Streaming/KiteTickerStreamer.cs` is a stub that logs a warning and never fires `FeedReceived`. Implement the KiteTicker binary WebSocket protocol (`wss://ws.kite.trade?api_key=...&access_token=...`) to deliver live LTP ticks for Zerodha positions.

- [ ] **`ZerodhaPortfolioStreamer` — full implementation**
  `backend/KAITerminal.Zerodha/Streaming/ZerodhaPortfolioStreamer.cs` is a stub. Zerodha does not have a portfolio push WebSocket like Upstox; investigate Kite postback (webhook) approach or poll-based portfolio updates.

- [ ] **Zerodha order-by-option-price endpoint**
  No Zerodha equivalent of `POST /api/upstox/orders/by-option-price/v3` exists yet. To fully support Quick Trade "By Price" for Zerodha:
  1. Add `POST /api/zerodha/orders/by-option-price` endpoint that resolves a strike from the Kite option chain and places a Kite order.
  2. Update `placeOrderByOptionPrice` in `trading-api.ts` to route to the Zerodha endpoint when the broker selector is set to Zerodha.

- [ ] **Zerodha "By Chain" orders (straddle/strangle)**
  Quick Trade "By Chain" tab currently toasts "coming soon" for Zerodha. Requires the option-price endpoint above plus Kite option chain integration.

- [ ] **Zerodha exit-position endpoint**
  `ZerodhaBrokerClient.ExitPositionAsync` calls `ZerodhaClient.ExitPositionAsync` which resolves the open position by instrument token and places a market order to close it. Verify end-to-end with a real Kite sandbox token.

---

### Frontend

- [ ] **Positions table — broker badge**
  Add a small `[U]` (indigo) or `[Z]` (blue) pill to each position row to indicate which broker the position belongs to. Requires:
  1. `Position.broker` field populated by the backend (currently always empty).
  2. Backend to set `broker = "upstox"` or `broker = "zerodha"` when aggregating positions.
  3. `PositionRow` component updated to render the badge.

- [ ] **Aggregate positions across both brokers**
  Currently the terminal fetches positions from Upstox only. To show a unified position list:
  1. Add `GET /api/zerodha/positions` endpoint.
  2. Update `fetchPositions` (or introduce a new combined fetch) to call both and merge, tagging each with `broker`.
  3. `PositionsHub` (SignalR) would need to aggregate both broker streams — complex; may be deferred to REST-only polling.

---

## Other Pending Items

- [ ] **Zerodha to Kite Connect sandbox test**
  End-to-end smoke test using a Kite Connect sandbox/paper trading account: connect → fetch positions → fetch funds → place + cancel order.

- [ ] **`UserRiskConfigs` Zerodha row via UI**
  Currently, Profit Protection config can only be set for Upstox (the UI doesn't have a broker picker on the PP panel). To run the risk engine for a Zerodha session, a row must be inserted manually:
  ```sql
  INSERT INTO "UserRiskConfigs" ("Username", "BrokerType", "Enabled", "MtmTarget", "MtmSl", ...)
  VALUES ('user@example.com', 'zerodha', true, 25000, -25000, ...);
  ```
  Future: add a broker toggle to the Profit Protection dialog.
