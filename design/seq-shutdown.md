# Sequence: Shutdown

```
McpServer       HomarUScc       Config      Timers      Browser     Channels    Skills      Memory
    |               |              |           |           |           |           |           |
    |--stop()------>|              |           |           |           |           |           |
    |               |--stopProcessing()       |           |           |           |           |
    |               |--resolve waiters (empty)|           |           |           |           |
    |               |--stopWatching()-->|     |           |           |           |           |
    |               |--stop()-------------------->|       |           |           |           |
    |               |<--timers stopped--------|   |       |           |           |           |
    |               |--stop()----------------------------->|          |           |           |
    |               |<--browser closed-----------------------|        |           |           |
    |               |--disconnectAll()------------------------------>|           |           |
    |               |<--channels disconnected--------------------------|         |           |
    |               |--stopAll()------------------------------------------------>|           |
    |               |<--skills stopped-------------------------------------------|           |
    |               |--stopWatching()--------------------------------------------------------------->|
    |               |--clear() queue  |           |           |           |           |           |
    |<--"stopped"---|              |           |           |           |           |           |
```
