# Sequence: Frontend App Loading
**Requirements:** R185, R188, R200, R210, R416

```
User          Sidebar         App.tsx        AppsView         DashboardServer
 |              |               |               |                   |
 |-- click ---->|               |               |                   |
 |  "Apps"      |-- setView -->|               |                   |
 |              |  ("apps")    |               |                   |
 |              |               |-- render ---->|                   |
 |              |               |               |                   |
 |              |               |               |-- GET /api/apps ->|
 |              |               |               |<-- [{manifest}] --|
 |              |               |               |                   |
 |              |               |   [no apps]   |                   |
 |              |               |               |-- render empty    |
 |              |               |               |   state (R210)    |
 |              |               |   [has apps]  |                   |
 |              |               |               |-- render cards    |
 |              |               |               |                   |
 |-- click ---->|               |               |                   |
 |  (budget)    |               |               |                   |
 |              |               |               |-- setSelected     |
 |              |               |               |   ("budget")      |
 |              |               |               |                   |
 |              |               |               |-- GET data.json ->|
 |              |               |               |<-- {data} --------|
 |              |               |               |                   |
 |              |               |               |-- AppRenderer     |
 |              |               |               |   (iframe or data)|
```

Notes:
- AppsView is registered as a sidebar skill via registerSkill() (R416)
- App selection is internal to AppsView (no sidebar route change)
- Apps with index.html render in iframe; others show data.json
- Mobile: same sidebar behavior as other views (close on selection)
- The DEDICATED_VIEWS set filters apps that have their own sidebar views (e.g., kanban)
