# Sequence: Timer Fire

```
Croner/setTimeout    TimerService    HomarUScc    EventQueue    McpServer    ClaudeCode
       |                 |              |            |              |            |
       |--callback()---->|              |            |              |            |
       |                 |--emit()----->|            |              |            |
       |                 | timer_fired  |            |              |            |
       |                 |              |--enqueue-->|              |            |
       |                 |              |--history   |              |            |
       |                 |              |            |              |            |
       |                 |  (if once)   |            |              |            |
       |                 |--remove()    |            |              |            |
       |                 |--saveTimers()|            |              |            |
       |                 |              |            |              |            |
       |                 |              | (50ms tick)|              |            |
       |                 |              |--dequeue-->|              |            |
       |                 |              |--notifyFn()-------------->|            |
       |                 |              |            |              |--notify--->|
       |                 |              |            |              |            |
       |                 |              |            |              | (reasons,  |
       |                 |              |            |              |  acts on   |
       |                 |              |            |              |  prompt)   |
```
