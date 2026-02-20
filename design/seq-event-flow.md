# Sequence: Event Flow (Telegram message → Claude Code response)

```
Telegram    TelegramAdapter   ChannelMgr    HomarUScc    EventQueue   EventBus    McpServer    ClaudeCode
    |             |               |            |            |            |            |            |
    |--update---->|               |            |            |            |            |            |
    |             |--checkAccess  |            |            |            |            |            |
    |             |--normalize    |            |            |            |            |            |
    |             |--deliver()--->|            |            |            |            |            |
    |             |               |--emit()-->|            |            |            |            |
    |             |               |            |--enqueue-->|            |            |            |
    |             |               |            |--history   |            |            |            |
    |             |               |            |--signal waiters         |            |            |
    |             |               |            |            |            |            |            |
    |             |               |            |  (50ms tick)            |            |            |
    |             |               |            |--dequeue-->|            |            |            |
    |             |               |            |<--event----|            |            |            |
    |             |               |            |--getHandlers()--------->|            |            |
    |             |               |            |<--{direct,agent}-------|            |            |
    |             |               |            |            |            |            |            |
    |             |               |            |--notifyFn(event)------->|            |            |
    |             |               |            |            |            |--notify--->|            |
    |             |               |            |            |            |            |--event---->|
    |             |               |            |            |            |            |            |
    |             |               |            |            |            |            |  (reasons) |
    |             |               |            |            |            |            |            |
    |             |               |            |            |            |            |<-CallTool--|
    |             |               |            |            |            |            | telegram   |
    |             |               |            |            |            |            | _send      |
    |             |               |  send()    |            |            |            |            |
    |<--sendMsg---|<--------------|<-----------|<-----------|------------|------------|            |
```
