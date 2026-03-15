# Reversal Sniper (RS)

A TradingView Pine Script **overlay** indicator built for **intraday option sellers**. It detects price reversals using **pure price action** — candlestick patterns, support/resistance, market structure, failed breakouts, rejection wicks, volume climax, and liquidity grabs. No RSI, no MACD, no indicators. Signals fire only when multiple price action methods agree (confluence scoring).

---

## Confluence Scoring (7 Methods)

A signal only fires when **3+ methods agree** (configurable via Min Confluence Score).

| # | Method | Bullish | Bearish |
|---|--------|---------|---------|
| 1 | **Candle pattern** | Engulfing, hammer, morning star, piercing line | Engulfing, shooting star, evening star, dark cloud cover |
| 2 | **Support / Resistance** | Price at pivot support level | Price at pivot resistance level |
| 3 | **Price structure** | Higher low forming | Lower high forming |
| 4 | **Failed breakout (trap)** | Bear trap — broke below support, closed back above | Bull trap — broke above resistance, closed back below |
| 5 | **Rejection wick** | Lower wick > 1.5× ATR (strong buyer rejection) | Upper wick > 1.5× ATR (strong seller rejection) |
| 6 | **Volume climax** | Volume spike ≥ 1.5× avg on bullish candle | Volume spike ≥ 1.5× avg on bearish candle |
| 7 | **Liquidity grab** | Sweeps prior swing low then closes green (smart money) | Sweeps prior swing high then closes red (smart money) |

---

## Signal Filters

| Filter | Default | Purpose |
|--------|---------|---------|
| **Min Confluence** | 3/7 | Minimum price action methods that must agree |
| **Max Stoploss** | 40 points | Signals with SL > 40 pts are hidden |
| **Min Target** | 20 points | Signals with target < 20 pts are hidden |
| **Risk:Reward Ratio** | 2:1 | Target = SL distance × R:R ratio |
| **Volume Spike** | 1.5× avg | Threshold for volume climax detection |
| **Cooldown** | Swing lookback × 2 | Prevents back-to-back duplicate signals |

---

## Candlestick Patterns

| Pattern | Direction | Detection |
|---------|-----------|-----------|
| **Bullish Engulfing** | Bullish | Green candle fully engulfs previous red candle, body is larger |
| **Bearish Engulfing** | Bearish | Red candle fully engulfs previous green candle, body is larger |
| **Hammer** | Bullish | Lower wick > 2× body, tiny upper wick, green close |
| **Shooting Star** | Bearish | Upper wick > 2× body, tiny lower wick, red close |
| **Morning Star** | Bullish | 3-candle: big red → doji → big green recovering > 50% |
| **Evening Star** | Bearish | 3-candle: big green → doji → big red dropping > 50% |
| **Piercing Line** | Bullish | Opens below prev low, closes above prev midpoint |
| **Dark Cloud Cover** | Bearish | Opens above prev high, closes below prev midpoint |

---

## Stoploss & Target

| Direction | Stoploss | Target |
|-----------|----------|--------|
| **Bullish reversal** | Swing low − 2 pts | Entry + (SL distance × R:R ratio) |
| **Bearish reversal** | Swing high + 2 pts | Entry − (SL distance × R:R ratio) |

Signals are **hidden** when:
- SL distance > Max Stoploss (default 40 pts)
- Target distance < Min Target (default 20 pts)

---

## Seller Actions

| Signal on chart | What to do |
|-----------------|------------|
| **PE** (green label, below bar) | Bullish reversal — sell put options |
| **CE** (red label, above bar) | Bearish reversal — sell call options |

---

## Visual Elements

| Element | Description |
|---------|-------------|
| **PE / CE labels** | Entry markers with confluence score (e.g. "5/7") |
| **Green solid line** | Entry price level |
| **Red dashed line** | Stoploss level with point distance |
| **Blue dashed line** | Target level with point distance |
| **S/R dots** | Green dots = support, red dots = resistance |
| **Info table** (top-right) | All 7 methods shown in Bull/Bear columns with live status |

---

## Alerts

| Alert | Trigger |
|-------|---------|
| Bullish Reversal — Sell PE | Confluence ≥ min score + SL/TP valid |
| Bearish Reversal — Sell CE | Confluence ≥ min score + SL/TP valid |

---

## Setup

1. Open TradingView → Pine Editor → paste `reversal_sniper.pine`
2. Add to intraday chart (recommended: **5m or 15m** on NIFTY / BANKNIFTY / SENSEX)
3. Adjust **Min Confluence Score** — raise to 4-5 for fewer signals, lower to 2 for more
4. Set **Max SL** and **Min Target** based on the instrument

### Recommended settings

| Instrument | Max SL | Min Target | Confluence | Swing |
|------------|--------|------------|:----------:|:-----:|
| NIFTY (5m) | 30-40 | 20 | 3 | 5 |
| BANKNIFTY (5m) | 40-60 | 30 | 3 | 5 |
| SENSEX (5m) | 40-50 | 25 | 3 | 5 |
| NIFTY (15m) | 50-70 | 30 | 4 | 5 |

---

## Customisation

- **Min Confluence Score** — the most impactful setting; 2 = more signals, 5 = very selective
- **Max Stoploss / Min Target** — controls risk/reward filtering
- **R:R Ratio** — increase to 2.5 or 3.0 for conservative targets
- **Swing Lookback** — higher = deeper swing for SL (wider), lower = tighter
- **S/R Pivot Lookback** — higher = stronger S/R levels, lower = more responsive
- **S/R Zone Width** — wider zone = more signals near S/R, tighter = stricter
- **Volume Spike** — raise to 2.0 for stricter volume climax detection
- **Show S/R Levels** — toggle support/resistance dots on chart
