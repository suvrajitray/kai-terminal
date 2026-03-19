# KAITerminal.Upstox

This document has been merged into the root [`README.md`](../../README.md).

See the **Upstox SDK** section for:
- DI registration (`AddUpstoxSdk`)
- Token generation (OAuth 2.0 flow)
- Per-call token scoping (`UpstoxTokenContext`)
- Market Data Streamer (protobuf WebSocket — FeedMode, subscription, events)
- Portfolio Streamer (JSON WebSocket — UpdateType, parsing)
- Error handling (`UpstoxException`)
- Protobuf / Apple Silicon regeneration note

See the **API Reference** section for all REST endpoints exposed by `KAITerminal.Api`.

For internal SDK architecture, named HttpClients, and design conventions, see [`CLAUDE.md`](CLAUDE.md).
