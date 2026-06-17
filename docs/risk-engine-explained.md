# The Risk Engine — What It Actually Does For You

A plain-English explanation of the risk engine feature. No technical jargon — just what it does for you as a trader.

---

## Table of Contents

- [The Core Idea: You Set Limits, It Obeys Them](#the-core-idea-you-set-limits-it-obeys-them)
- [The 4 Main Protections (in the order they're checked)](#the-4-main-protections-in-the-order-theyre-checked)
  - [1. Stop-Loss — "Don't let me lose more than this"](#1-stop-loss--dont-let-me-lose-more-than-this)
  - [2. Target — "Once I've made this much, book it and stop"](#2-target--once-ive-made-this-much-book-it-and-stop)
  - [3. Auto Square-Off Time — "Get me out by this time of day"](#3-auto-square-off-time--get-me-out-by-this-time-of-day)
  - [4. Trailing Stop-Loss — "Protect my profits as they grow"](#4-trailing-stop-loss--protect-my-profits-as-they-grow-the-smartest-one)
- [Which Positions It Watches — "Watched Products"](#which-positions-it-watches--watched-products)
- [How It Exits — Carefully, Not Clumsily](#how-it-exits--carefully-not-clumsily)
- [Auto-Shift — "Roll my position to a safer strike"](#auto-shift--roll-my-position-to-a-safer-strike-instead-of-just-exiting)
- [Profit Protection (PP) — Your On/Off Switch](#profit-protection-pp--your-onoff-switch)
- [Multiple Users, Multiple Brokers, One Engine](#multiple-users-multiple-brokers-one-engine)
  - [Important: the engine works per broker, not across brokers](#important-the-engine-works-per-broker-not-across-brokers)
- [You Get Notified](#you-get-notified)
- [The One-Sentence Summary](#the-one-sentence-summary)

---

Think of the risk engine as an **automated bodyguard for your trading account**. You're trading options (NIFTY, BANKNIFTY, SENSEX, etc.), and the market moves every second. A human can't watch every position all day without blinking. The risk engine does exactly that — it watches your live positions continuously and **automatically exits trades** the moment your own pre-set rules are breached. No emotions, no hesitation, no "let me wait just a bit more."

You set the rules once. The engine enforces them relentlessly.

---

## The Core Idea: You Set Limits, It Obeys Them

Everything revolves around your **MTM** — "Mark to Market," which is just a fancy term for **your live running profit or loss right now**, second by second, across all your positions combined.

The engine constantly asks: *"Based on the user's rules, should I get them out right now?"* It checks the rules **in a strict priority order**, and the first one that triggers wins.

---

## The 4 Main Protections (in the order they're checked)

### 1. Stop-Loss — "Don't let me lose more than this"

You decide the maximum money you're willing to lose for the day — say ₹10,000. The moment your combined loss hits that number, the engine **immediately closes every position**. This is your safety net against a bad day turning into a disaster. It's the **first** thing checked, because protecting capital comes before everything else.

### 2. Target — "Once I've made this much, book it and stop"

The opposite of stop-loss. You set a profit goal — say ₹15,000. The second your profit reaches it, the engine **closes everything and locks in the win**. This protects you from the classic trap of being up nicely, getting greedy, and watching the profit evaporate.

### 3. Auto Square-Off Time — "Get me out by this time of day"

You can set a clock-based exit — for example, **3:15 PM**. When that time arrives (Indian market time), the engine exits all positions regardless of profit or loss. This is for traders who never want to carry positions to the end of the day, or who want to avoid the volatile final minutes before market close.

### 4. Trailing Stop-Loss — "Protect my profits as they grow" (the smartest one)

This is the most sophisticated feature. Instead of a fixed exit point, it **follows your profit upward and locks in gains along the way**. Here's how it works in plain terms:

- **It stays dormant** until you've reached a certain profit level (your "activation point"). No point trailing when you're barely in profit.
- **Once activated, it sets a floor** — a guaranteed minimum profit you'll walk away with. Even if the market reverses, you won't give back more than that.
- **As your profit keeps climbing, the floor climbs too.** Every time profit rises by a chunk you define, the protected floor ratchets up a notch. It only ever moves up — never down.
- **If the market turns and your profit falls back to that floor, it exits instantly.**

The beauty: you let winners run, but you never give the whole thing back. It's like a ratchet that tightens but never loosens.

#### A real numeric example

Suppose you set these four numbers:

| Setting | Value | What it means |
|---|---|---|
| **Activate at** | ₹5,000 | Don't start trailing until I'm up ₹5,000 |
| **Lock profit at** | ₹3,000 | The instant trailing turns on, guarantee me at least ₹3,000 |
| **When profit increases by** | ₹2,000 | For every extra ₹2,000 I make... |
| **Increase trailing by** | ₹1,500 | ...raise my guaranteed floor by ₹1,500 |

Now watch what happens as your profit moves through the day:

| Time | Your live profit (MTM) | What the engine does | Your protected floor |
|---|---|---|---|
| 9:30 AM | ₹1,200 | Trailing still asleep (below ₹5,000) | — none yet |
| 10:15 AM | **₹5,000** | **Trailing activates** — locks the floor | **₹3,000** |
| 11:00 AM | **₹7,000** (up ₹2,000) | Floor ratchets up by ₹1,500 | **₹4,500** |
| 12:10 PM | **₹9,000** (up another ₹2,000) | Floor ratchets up again | **₹6,000** |
| 1:20 PM | **₹11,000** (up another ₹2,000) | Floor ratchets up again | **₹7,500** |
| 1:45 PM | ₹10,200 (market reverses) | Still above floor — **holds, does nothing** | ₹7,500 |
| 2:05 PM | **₹7,500** (keeps falling) | Profit has touched the floor → **exits everything instantly** | ✅ booked ~₹7,500 |

**The takeaway:** your profit peaked at ₹11,000 and then the market turned against you. Without trailing, a panicking or distracted trader might have ridden it all the way back to ₹0 — or into a loss. The engine instead **walked you out with ₹7,500 locked in**, automatically, the moment your gains slipped back to the floor it had been quietly raising all day. You captured most of the move and protected the rest, without lifting a finger.

Notice the floor **only ever moved up** — at 1:45 PM when profit dipped to ₹10,200, the floor stayed at ₹7,500. It never loosens its grip.

---

## Which Positions It Watches — "Watched Products"

You don't have to apply the engine to everything. You can tell it to watch:

- **All** positions, or
- **Only intraday** (same-day) trades, or
- **Only delivery** (overnight/longer-term) trades.

So if you want the engine aggressively managing your fast intraday bets but leaving your longer-term holdings alone, you can. Importantly — **this only affects what it acts on, not what you see.** Your screen still shows everything; the engine just enforces rules on the subset you chose.

---

## How It Exits — Carefully, Not Clumsily

When the engine decides to close your positions, it doesn't just dump everything blindly:

- **It always fetches your true, current positions fresh from the broker** before acting — it never trusts a stale snapshot. This avoids the nightmare of trying to exit something you've already closed, or missing something new.
- **It exits your "sell" positions first.** In options trading, sold positions tie up margin (a security deposit with the broker). Closing those first frees up margin and prevents your account from briefly hitting a margin shortfall during the exit. It's a small, smart sequencing detail that protects you from broker-side problems mid-exit.
- **It confirms a real exit happened** before declaring the job done — so you get an honest "you're out" rather than a false alarm.

---

## Auto-Shift — "Roll my position to a safer strike instead of just exiting"

This is an advanced, optional feature for **option sellers**. When you sell an option, you collect a premium and profit as long as the market behaves. But if the market starts moving against you, the option you sold gets more expensive — that's a growing loss. Instead of just closing the trade, auto-shift lets you **roll the position to a safer strike** that's further out of harm's way, and keep collecting premium there.

Here's the logic in plain terms:

- **The trigger:** for each option you've sold, the engine watches its live price. The moment that price climbs a set percentage above what you sold it for (your "shift threshold"), it acts. A rising price on a sold option means the market is coming after you.
- **The shift:** it buys back the now-dangerous option and **sells a new one a fixed number of strikes further away** — lower strikes for puts (PE), higher strikes for calls (CE) — i.e. further from the current market price, where you're safer.
- **The limit:** you set a **maximum number of shifts** per position. The engine will roll you to safety that many times — but no more. The market can't be chased forever.
- **The exit:** once a position has been shifted the maximum number of times and the market is *still* coming after it, the engine stops rolling and **closes the position entirely.** It cuts the loss rather than chasing a runaway market indefinitely.

It keeps track of the original position even after it's been shifted, so the shift-counter follows the trade across every strike it moves to. And it has guardrails so it never accidentally fires the same shift twice or sends duplicate orders on repeated price ticks. It's careful about not making a mess.

#### A real numeric example

You're a **put (PE) seller** on NIFTY. Suppose you set these:

| Setting | Value | What it means |
|---|---|---|
| **Shift threshold** | 50% | Roll me when a sold option's price rises 50% above my entry |
| **Strike gap** | 100 points | Each shift moves me 100 points further out |
| **Max shifts** | 2 | Roll me at most twice, then exit |

Now the market starts falling toward your strike, and watch the engine work:

| Step | What's happening | Engine action | Shift count |
|---|---|---|---|
| **Start** | You sold the **NIFTY 22000 PE** for **₹100**. Trigger price = ₹150 (50% above ₹100). | — holding, collecting premium | 0 |
| **Shift 1** | Market drops, the 22000 PE climbs to **₹150**. | Buy back 22000 PE → **sell the 21900 PE** (100 points lower, safer) | 1 |
| **Shift 2** | Market keeps falling, the new 21900 PE you sold (say at ₹95) climbs to its trigger (~₹142). | Buy back 21900 PE → **sell the 21800 PE** (another 100 points lower) | 2 |
| **Exhausted** | Market *still* falling, the 21800 PE climbs past its trigger again. You've already shifted the maximum of 2 times. | **Stop rolling — close the position entirely** and lock in the loss | 2 (maxed) |

**The takeaway:** twice, the engine pulled you out of danger and re-positioned you further from the falling market — buying you room and keeping you earning premium. But it didn't fight a clearly losing battle forever. Once you hit your shift limit and the market was *still* against you, it accepted the situation and **cut the position cleanly** rather than bleeding indefinitely. You get the upside of "give the trade a chance to recover" with a hard, automatic stop on how far you'll chase it.

For **call (CE) sellers** it's the exact mirror image — when the market rises against you, it rolls you to *higher* strikes instead of lower ones.

---

## Profit Protection (PP) — Your On/Off Switch

On your screen, there's a **Profit Protection toggle**. This is your master control to turn the engine's automated management **on or off** per setup. When you flip it, the change feels instant on screen (it assumes success and updates immediately for a snappy experience).

One important honesty point about the design: **the toggle and the display on your screen are just showing you what's happening — they don't fire the actual exits themselves.** The real exits are executed by a separate, always-running background service (the "Worker") that runs independently and reliably even if your screen is closed or your browser crashes. Your dashboard is the cockpit display; the engine is the autopilot doing the real flying.

---

## Multiple Users, Multiple Brokers, One Engine

- The engine runs for **many users at once**, each with their own private rules and positions — they never interfere with each other.
- It works across **two brokers — Upstox and Zerodha** — and treats them uniformly, so your rules behave the same regardless of where your account is.
- It runs **24/7 in the background on a server**, not on your computer. So even if you shut your laptop, the bodyguard is still on duty.

### Important: the engine works **per broker, not across brokers**

This is a crucial point to understand. If you trade on **both** Upstox and Zerodha, the engine treats them as **two completely separate accounts**:

- You set **separate rules for each broker** — your stop-loss, target, trailing settings, and auto square-off time on Upstox are independent from the ones on Zerodha.
- Each broker has its **own running profit/loss**, calculated only from the positions held *at that broker*. **The engine does NOT add up your profit and loss across both brokers into one combined number.**

**What this means in practice:** suppose you're **down ₹8,000 on Upstox** but **up ₹6,000 on Zerodha**. Across both your real net position is only ₹2,000 down. But the engine doesn't see it that way — it watches each broker on its own. If your Upstox stop-loss is set to ₹8,000, it will **fire and exit your Upstox positions** the moment that broker alone hits ₹8,000 down — completely ignoring the ₹6,000 cushion sitting in your Zerodha account.

So when you set your limits, set them **with each broker in mind separately** — not as a single combined account-wide number. There is currently **no setting that caps your total loss or profit across both brokers together.**

---

## You Get Notified

When something happens — a stop-loss fires, a target is hit, a trailing stop locks in, an auto-shift occurs — you get a **toast notification** (a little pop-up alert) and your positions on screen refresh automatically, so you always know what the engine just did on your behalf. The broker can also notify the system directly when an order fills, keeping your view in sync with reality.

---

## The One-Sentence Summary

**The risk engine is an always-on, emotion-free automated trade manager that watches your live profit and loss every second, and the instant you hit a loss limit, a profit target, a cut-off time, or a trailing-profit floor that you defined, it cleanly and safely exits your positions for you — so you never lose more than you decided, never give back more profit than you're willing to, and never have to babysit the screen.**
