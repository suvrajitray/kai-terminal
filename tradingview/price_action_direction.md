# Price Action Direction (PAD)

A TradingView Pine Script indicator built for **intraday option sellers**. It determines market direction using **pure price action** — market structure, trend strength, close position, candle momentum, breakouts, S/R bias, and volume direction. No RSI, no MACD, no indicators. Signals show PE or CE entry with SL/TP lines on the main chart.

---

## 7 Price Action Methods

| # | Method | What it reads | Max Score |
|---|--------|---------------|:-:|
| 1 | **Structure** | HH+HL = strong bullish, HL only = partial bullish, LH+LL = strong bearish | ±2 |
| 2 | **Trend** | Count of bull vs bear candles over lookback period | ±2 |
| 3 | **Close position** | Where price sits within recent range (top 30% = bull, bottom 30% = bear) | ±2 |
| 4 | **Candle momentum** | Are bull/bear candle bodies getting bigger? (momentum building) | ±1 |
| 5 | **Breakout** | Breaking above range high or below range low | ±2 |
| 6 | **S/R bias** | Trading above resistance = bullish, below support = bearish | ±1 |
| 7 | **Volume direction** | More volume on up candles or down candles? | ±1 |

Total score range: **-11 to +11**, normalised to **-100% to +100%**.

---

## Score Thresholds

| Score | Direction | Action |
|-------|-----------|--------|
| ≥ +30% with volume spike | **SELL PE** | Strong bullish — sell puts confidently |
| ≥ +30% | **SELL PE (watch)** | Bullish but no volume spike — watch for confirmation |
| ≤ -30% with volume spike | **SELL CE** | Strong bearish — sell calls confidently |
| ≤ -30% | **SELL CE (watch)** | Bearish but no volume spike — watch for confirmation |
| Between -30% and +30% | **NO SIGNAL** | No clear direction — stay flat |

---

## Signal Filters

| Filter | Default | Purpose |
|--------|---------|---------|
| **Max Stoploss** | 40 points | Entry hidden if SL > 40 pts |
| **Min Target** | 20 points | Entry hidden if target < 20 pts |
| **Risk:Reward Ratio** | 2:1 | Target = SL distance × R:R ratio |

---

## Stoploss & Target

| Direction | Stoploss | Target |
|-----------|----------|--------|
| **PE entry (bullish)** | Swing low − 2 pts | Entry + (SL distance × R:R ratio) |
| **CE entry (bearish)** | Swing high + 2 pts | Entry − (SL distance × R:R ratio) |

---

## Visual Elements

| Element | Description |
|---------|-------------|
| **PE label** (green, below bar) | Bullish entry on main chart |
| **CE label** (red, above bar) | Bearish entry on main chart |
| **Green solid line** | Entry price level |
| **Red dashed line** | Stoploss with point distance |
| **Blue dashed line** | Target with point distance |
| **Histogram** | Score % as coloured columns in sub-pane |
| **Score table** (main chart, top-right) | All 7 methods with individual scores and signals |
| **Last bar label** | Current direction + seller action + score % |

---

## Table Breakdown

The score table shows each method's live reading:

| Row | Shows |
|-----|-------|
| **Structure** | HH+HL, HL, LH+LL, LH, or Flat |
| **Trend** | Bull/bear candle count (e.g. "7B / 3S") |
| **Close Position** | Where price sits in range as % |
| **Momentum** | Whether bull or bear candle bodies are growing |
| **Breakout** | Breaking above range high or below range low |
| **S/R Bias** | Above resistance, below support, or between |
| **Vol Direction** | Which side has more volume |
| **Result** | Final action (SELL PE / SELL CE / NO SIGNAL) with score % |
| **Range** | Current range low — high with size in points |

---

## Alerts

| Alert | Trigger |
|-------|---------|
| Bullish — Sell PE | Score crosses above +30% with valid SL/TP |
| Bearish — Sell CE | Score crosses below -30% with valid SL/TP |

---

## Setup

1. Open TradingView → Pine Editor → paste `price_action_direction.pine`
2. Add to intraday chart (recommended: **5m or 15m** on NIFTY / BANKNIFTY / SENSEX)
3. Adjust **Max SL**, **Min Target**, and **R:R Ratio** for the instrument
4. Set up alerts for PE/CE signals

### Recommended settings

| Instrument | Max SL | Min Target | Swing | Trend Bars |
|------------|--------|------------|:-----:|:----------:|
| NIFTY (5m) | 30-40 | 20 | 5 | 10 |
| BANKNIFTY (5m) | 40-60 | 30 | 5 | 10 |
| SENSEX (5m) | 40-50 | 25 | 5 | 10 |
| NIFTY (15m) | 50-70 | 30 | 5 | 15 |

---

## Customisation

- **Swing Lookback** — controls SL placement depth; higher = wider SL
- **S/R Pivot Lookback** — higher = stronger pivots, lower = more responsive
- **Trend Strength Lookback** — number of bars for trend counting and range calculation
- **Volume MA Length** — period for volume spike detection
- **Max SL / Min Target / R:R** — risk/reward filtering
- **SL/TP Line Length** — how far forward the lines extend
- **Show SL/TP Lines** — toggle for cleaner chart

---

## Using All Three Indicators Together

| Indicator | Purpose | Type |
|-----------|---------|------|
| **Market Direction Predictor** | Overall direction using 7 weighted indicators | Indicator-based |
| **Price Action Direction** | Direction using pure price action | Price action |
| **Reversal Sniper** | Precise reversal entries with SL/TP | Price action |

**Workflow:**
1. Check **MDP** or **PAD** for market direction (PE or CE bias)
2. Wait for **Reversal Sniper** to confirm with an entry signal in the same direction
3. Execute with the plotted SL/TP levels
