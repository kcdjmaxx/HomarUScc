# Channels

**Language:** TypeScript
**Environment:** Node.js >= 22

Channels are the I/O layer — they connect HomarUScc to the outside world.

## Channel Manager

The ChannelManager loads channel adapters from config, manages their lifecycle (connect/disconnect), routes outbound messages, and provides health checks.

## Base Adapter

All channels extend ChannelAdapter, which provides:

- Connection state machine: disconnected → connecting → connected (or error)
- Access control via DM policy (pairing, allowlist, open, disabled) and group policy (mention_required, always_on, disabled)
- Inbound message normalization to a standard Event format
- Outbound message delivery

## Telegram Adapter

- Polls the Telegram Bot API using getUpdates with long-polling
- Exponential backoff on errors (doubling from 1s to max 30s)
- Detects @mentions for group policy enforcement
- Maintains a buffer of the 50 most recent messages for the telegram_read tool
- Supports allowedChatIds whitelist for access control

## Dashboard Adapter

- Bridges the web dashboard's WebSocket chat to the event loop
- Receives messages from dashboard users via DashboardServer
- Sends outbound messages back through an outbound handler wired to WebSocket broadcast
