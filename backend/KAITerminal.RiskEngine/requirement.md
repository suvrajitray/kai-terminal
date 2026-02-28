### Risk Management

1. Overall MTM stoploss
   1. System should check in every minute if over all SL price reaches it should close all the open positions.
2. Overall MTM target
   1. System should close all the positions once target achived
3. SL Trailing
   1. System should able to trail the SL after reaching configured value
4. Strike price SL
   1. System should exit the positions once average price is 30% lower of LTP, 30% for PE and 20% for CE after exiting the position it will take one more position with same qty with next OTM stike price
   2. It should take position only twice.

# 📘 Automated Risk Management — Requirements Document

## 1. Overview

This document defines the functional and technical requirements for the **Automated Risk Management Background Job** in the trading terminal.
The module continuously monitors portfolio MTM and individual strikes and performs automated exits/re-entries to protect capital and lock profits.

---

## 2. Scope

The Risk Management Engine will:

- Run as a background job
- Monitor MTM and positions in near-real time
- Execute exit orders automatically
- Handle strike-level stop loss and controlled re-entry
- Support trailing stop loss logic
- Be configurable per user/session

---

## 3. Definitions

| Term           | Meaning                       |
| -------------- | ----------------------------- |
| MTM            | Mark-to-Market profit/loss    |
| Overall SL     | Portfolio level loss limit    |
| Overall Target | Portfolio level profit target |
| LTP            | Last Traded Price             |
| CE             | Call Option                   |
| PE             | Put Option                    |
| OTM            | Out of The Money              |
| TSL            | Trailing Stop Loss            |

---

# ⚙️ 4. Functional Requirements

---

## 4.1 Overall MTM Stop Loss

### Description

System must square off **all open positions** when portfolio MTM loss reaches configured stop loss.

### Requirements

- System checks MTM every **1 minute**
- Configurable value per user
- Works across all positions
- Must trigger only once per trading session

### Trigger Condition

``If CurrentMTM <= OverallStopLoss

### Action

- Cancel all pending orders
- Exit all open positions (market order)
- Mark risk status = `SL_HIT`
- Disable further trading for session

### Edge Cases

- Handle partial fills
- Retry failed exits
- Prevent duplicate execution

---

## 4.2 Overall MTM Target

### Description

System exits all positions once overall profit target is achieved.

### Requirements

- Checked every minute
- Configurable target
- One-time trigger per session

### Trigger Condition

If CurrentMTM >= OverallTarget

### Action

- Exit all open positions
- Cancel pending orders
- Mark status = `TARGET_HIT`
- Lock further entries (configurable)

---

## 4.3 Trailing Stop Loss (Portfolio Level)

### Description

System dynamically moves overall stop loss when profit increases.

---

### Configuration Fields

| Field          | Description                    |
| -------------- | ------------------------------ |
| Activate At    | Profit level to start trailing |
| Lock Profit At | Initial SL after activation    |
| Profit Step    | Profit increase step           |
| TSL Increment  | Amount to trail SL             |

---

### Logic Flow

#### Step 1 — Activation

If MTM >= ActivateAt
→ Trailing becomes active
→ OverallSL = LockProfitAt

---

#### Step 2 — Trailing Movement

For every profit step crossed:

If MTM increases by ProfitStep
→ OverallSL += TSLIncrement

---

### Example

| Parameter      | Value  |
| -------------- | ------ |
| Activate At    | ₹5,000 |
| Lock Profit At | ₹2,000 |
| Profit Step    | ₹1,000 |
| TSL Increment  | ₹500   |

**Flow:**

- MTM hits 5k → SL becomes 2k
- MTM hits 6k → SL becomes 2.5k
- MTM hits 7k → SL becomes 3k

---

### Safety Rules

- SL must never decrease
- Trailing must stop after positions closed
- Works with Overall SL

---

## 4.4 Strike Price Stop Loss with Re-entry

⚠️ This is your **most critical and complex logic**

---

### Description

System monitors individual option positions and:

1. Exits when price moves adversely
2. Takes next OTM position
3. Maximum **2 re-entries only**

---

## 4.4.1 Stop Loss Conditions

### For PE

Exit when LTP >= AvgPrice × 1.30

(30% adverse move)

---

### For CE

Exit when LTP >= AvgPrice × 1.20

(20% adverse move)

---

✅ Note: This assumes **short positions** (typical option selling).

If you are doing buying strategies, confirm — logic will reverse.

---

## 4.4.2 Exit Action

When SL hit:

- Exit position immediately (market order)
- Increment re-entry counter
- Log event
- Evaluate re-entry eligibility

---

## 4.4.3 Re-entry Rules

System should:

- Take next OTM strike
- Same quantity
- Same option type (CE/PE)
- Maximum **2 times per leg**

---

### Re-entry Condition

If ReEntryCount < 2
→ Take new position
Else
→ Do nothing

---

## 4.4.4 Strike Selection Logic

Next OTM strike should be:

- For CE → higher strike
- For PE → lower strike

---

### Example

| Position       | Next Strike |
| -------------- | ----------- |
| NIFTY 22000 CE | 22100 CE    |
| NIFTY 22000 PE | 21900 PE    |

(Strike gap configurable)

---

## 4.4.5 Safeguards

System must:

- Prevent infinite loops
- Track per-leg re-entry count
- Avoid duplicate orders
- Handle order rejection
- Handle freeze quantity limits

---

# 🔄 5. Background Job Requirements

---

## 5.1 Job Frequency

| Check          | Frequency                       |
| -------------- | ------------------------------- |
| MTM monitoring | Every 60 seconds                |
| Strike SL      | Every tick (preferred) or 5 sec |
| Trailing logic | Every MTM refresh               |
