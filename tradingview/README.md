# Market Direction Predictor (MDP)

A TradingView Pine Script indicator built for **intraday option sellers**. It combines 7 weighted indicators, volume confirmation, and volatility analysis to produce a single directional score with explicit seller actions (SELL PE / SELL CE / SELL BOTH / NO TRADE).

---

## Indicators & Weights

| Indicator | Default Weight | What it measures |
|-----------|:-:|---|
| **EMA Alignment** (9/21/50) | ×2 | Short-term trend structure — all three EMAs stacked = directional |
| **VWAP** | ×2 | Institutional intraday anchor — above = bullish, below = bearish |
| **Dual Supertrend** (2/10 + 3/14) | ×2 | Trend direction — both fast & slow must agree for a vote |
| **HTF EMA Trend** (60m) | ×2 | Higher timeframe filter — prevents trading against the hourly trend |
| **MACD** (12/26/9) | ×1 | Momentum — includes histogram direction for early signals |
| **RSI** (14) | ×1 | Overbought/oversold momentum filter |
| **ADX / DMI** (14) | ×1 | Trend strength — only votes when ADX > 20 |

Trend indicators are weighted ×2, oscillators ×1. All weights are adjustable in settings.

---

## Score System

Each indicator votes **+1** (bullish), **-1** (bearish), or **0** (neutral), multiplied by its weight. The raw total is normalised to a **-100% to +100%** scale.

| Score | Signal |
|-------|--------|
| ≥ +50% with volume | **Strong Bullish** |
| ≥ +50% without volume | **Weak Bullish** |
| ≤ -50% with volume | **Strong Bearish** |
| ≤ -50% without volume | **Weak Bearish** |
| Between -50% and +50% | **Neutral** (see Seller Actions below) |

---

## Seller Actions

| Signal | Action | When it triggers |
|--------|--------|------------------|
| **SELL PE** | Sell put options confidently | Strong bullish (score ≥ 50% + volume) |
| **SELL CE** | Sell call options confidently | Strong bearish (score ≤ -50% + volume) |
| **SELL PE (weak)** | Sell puts, reduced size | Bullish but low volume — potential trap |
| **SELL CE (weak)** | Sell calls, reduced size | Bearish but low volume — potential trap |
| **SELL BOTH (squeeze)** | Sell strangle / iron condor | Neutral + BB squeeze active — tight range, premium decaying fast |
| **SELL BOTH** | Sell strangle / iron condor | Neutral + volatility not high (BB width < 75th percentile) — market is range-bound |
| **NO TRADE** | Stay flat | Neutral + high volatility (BB width > 75th percentile) — breakout likely, dangerous for sellers |

### Key insight: Neutral ≠ always sell both

When the score is neutral (between -50% and +50%), the action depends on **volatility**:

- **Low/normal volatility** → market is genuinely range-bound → **SELL BOTH** (strangle or iron condor)
- **BB Squeeze active** → volatility extremely compressed → **SELL BOTH (squeeze)** — best premium decay, but watch for squeeze release
- **High volatility** (BB width > 75th percentile) → bands are expanding, breakout is brewing → **NO TRADE** — selling both sides here can get you crushed

---

## Volatility Analysis

The indicator uses **Bollinger Band width** relative to **Keltner Channels** to assess volatility:

- **BB Squeeze** (BB inside KC) — volatility at extreme compression, orange background on histogram
- **Low Vol** (BB width percentile < 25) — bands narrower than 75% of recent history
- **Normal Vol** (25-75 percentile) — safe for range-bound strategies
- **High Vol** (> 75 percentile) — bands expanding, directional move likely, avoid non-directional sells

The table shows:
- **Volatility row** — current state (SQUEEZE / LOW VOL / NORMAL) with BB width percentile
- **Squeeze fire alerts** — notify when squeeze releases upward or downward (expect breakout, close the losing side)

---

## Volume Confirmation

Signals are gated by volume relative to the 20-period moving average:

- **Strong signal** — score beyond threshold AND volume ≥ 1× average → full-colour bars, confident action
- **Weak signal** — score beyond threshold but volume is thin → faded bars, "(weak)" label, reduce position size

---

## Visual Elements

| Element | Description |
|---------|-------------|
| **Histogram** | Score % as coloured columns — green (bull), red (bear), orange (sell both), faded red (no trade), gray (neutral) |
| **Bar colouring** | Chart bars tinted by signal — bright for strong, faded for weak, orange for sell both |
| **Score table** (main chart, top-right) | Breakdown of every indicator's vote, weight, volatility state, volume, and the final seller action |
| **Label** (last bar) | Current signal + seller action + score % |
| **Dotted lines** | ±50% thresholds |
| **Orange background** | Active squeeze zone |

---

## Alerts

| Alert | Trigger |
|-------|---------|
| Strong Bullish → Sell PE | Score crosses above +50% with volume |
| Strong Bearish → Sell CE | Score crosses below -50% with volume |
| Weak Bullish | Score above +50% without volume |
| Weak Bearish | Score below -50% without volume |
| Squeeze Detected | BB enters KC — range-bound market, sell both sides |
| Squeeze Fire Up | Squeeze releases with price above BB midline — expect breakout |
| Squeeze Fire Down | Squeeze releases with price below BB midline — expect breakdown |
| Neutral Signal | Score returns to neutral zone |

---

## Setup

1. Open TradingView → Pine Editor → paste the contents of `market_direction_predictor.pine`
2. Add to your intraday chart (recommended: **5m or 15m** timeframe on NIFTY / BANKNIFTY / SENSEX)
3. Adjust the **HTF Confirmation** timeframe if needed (default: 60m)
4. Set up alerts for the signals you want notifications on

### Recommended timeframe combinations

| Chart TF | HTF Setting | Use case |
|----------|-------------|----------|
| 5m | 60m | Scalping / quick entries |
| 15m | 60m | Standard intraday (recommended) |
| 30m | 240m | Swing intraday |

---

## Customisation

All parameters are adjustable in the indicator settings:

- **EMA lengths** — adjust for faster/slower trend detection
- **Supertrend factors** — lower = more sensitive, higher = fewer signals
- **RSI thresholds** — widen (60/40) for fewer signals, narrow (52/48) for more
- **ADX minimum strength** — raise to 25 to filter out weak trends
- **Weights** — increase weight of indicators you trust most (1-3 range)
- **Volume multiplier** — raise to 1.5 to require stronger volume confirmation
- **VWAP toggle** — disable for non-intraday use
- **BB/KC parameters** — tune squeeze sensitivity (tighter KC multiplier = more frequent squeezes)
