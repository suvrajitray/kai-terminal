# Trading Terminal - Requirements

## 1. Overview

The Trading Terminal is a high-performance web application designed for active intraday traders optionX style. It provides real-time market data, position monitoring, order execution, and automated risk management. The system integrates with broker APIs (primarily Upstox, with future support for Zerodha and Dhan) and is optimized for low latency and reliability.

## 2. Goals & Objectives

- Provide Zerodha-style fast trading experience
- Enable real-time P&L tracking
- Implement automated risk management
- Ensure production-grade reliability
- Maintain clean, minimal UI for speed traders
- Support solo developer maintainability

## 3. Tech Stack

### 3.1 Frontend

- React
- Tailwind CSS
- Zustand (state management)
- Vite (build tool)
- WebSocket client

### 3.2 Backend

- ASP.NET Core Minimal API
- HttpClient integration
- WebSocket gateway
- Background hosted services

### 3.3 Broker Integration

- Upstox API
- Upstox WebSocket
- Future: Zerodha, Dhan

## 4. Core Features

### 4.1 Authentication

**Requirements**

- Support Google login and connect to multiple brokers
- Generate access token from request token

### 4.2 Market Data (Realtime)

**Requirements**

- Subscribe to broker WebSocket
- Stream live ticks
- Update UI without refresh
- Handle reconnect automatically

**UI Behavior**

- Price blinking on change
- Efficient diff updates
- Support multiple instruments

### 4.3 Orders Module

**Capabilities**

- Place order (Market / Limit / SL / SL-M)
- Modify order
- Cancel order
- Exit all positions

**Validation Rules**

- Quantity validation
- Product type validation
- Order type compatibility

### 4.4 Positions Page (OptionX Style)

A persistent bottom banner visible on all pages.

**Must Show**

- Current MTM P&L
- Exit All button
- Risk controls

**Risk Controls UI**

- MTM Stop Loss
- MTM Target
- Trailing Stop Loss

**Trailing Fields**

- Activate At
- Lock Profit At
- When Profit Increases By
- Increase TSL By

## 5. Automated Risk Management Engine

Runs as a backend background service.

### 5.1 Overall MTM Stop Loss

**Logic**

- Check every minute
- If overall MTM <= SL:
  - Exit all open positions
  - Cancel pending orders

### 5.2 Overall MTM Target

**Logic**

- Check every minute
- If MTM >= target:
  - Exit all positions

### 5.3 Trailing Stop Loss

**State Machine**

- Activate when profit reaches "Activate At"
- Lock minimum profit at "Lock Profit At"
- For every profit increase by X, increase TSL by Y

**Requirements**

- Must be deterministic
- Must survive service restart
- Must be idempotent

## 6. Upstox Integration Layer

### 6.1 HttpClient Wrapper

**Requirements**

- Typed HttpClient
- AccessToken custom value object
- Automatic header injection
- Retry policy
- Rate-limit awareness

### 6.2 WebSocket Gateway

**Responsibilities**

- Maintain single broker WebSocket connection
- Fan-out to frontend clients
- Handle reconnection
- Heartbeat monitoring

## 7. State Management (Frontend)

- Using Zustand

## 8. Reliability & Production Readiness

### 8.1 Backend

- Structured logging
- Retry policies
- Circuit breakers
- Graceful shutdown
- Health checks

### 8.2 WebSocket

- Auto reconnect
- Backoff strategy
- Connection status indicator

### 8.3 Data Safety

- Idempotent exit-all
- Duplicate order protection

## 9. UX Principles

- Keyboard-first trading
- Minimal clicks
- Dark theme friendly
- Fast visual feedback
- No UI lag

## 10. Future Enhancements

- Multi-broker support
- Options strategy builder
- Advanced order types
- Mobile responsive view
- Trade journal integration
