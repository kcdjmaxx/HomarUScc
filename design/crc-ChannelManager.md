# ChannelManager
**Requirements:** R15, R16, R18
**Refs:** ref-telegram-bot-api

## Knows
- adapters: map of channel name → ChannelAdapter
- eventHandler: callback to emit events into the loop

## Does
- loadAdapters: create adapter instances from config
- registerAdapter: add a pre-built adapter (e.g., DashboardAdapter)
- connectAll: connect all registered adapters
- disconnectAll: disconnect all adapters
- send: route outbound message to named channel
- getAdapter: look up adapter by name
- getConnected: list connected adapter names
- healthCheck: aggregate health from all adapters

## Collaborators
- ChannelAdapter: individual channel implementations
- TelegramChannelAdapter: Telegram polling
- DashboardAdapter: dashboard WebSocket bridge
- HomarUScc: receives events via eventHandler

## Sequences
- seq-startup.md
- seq-event-flow.md
