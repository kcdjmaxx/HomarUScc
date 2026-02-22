# Sequence: Frontend App Loading
**Requirements:** R185, R188, R199, R200, R210

```
User            Sidebar          App.tsx         AppsView         DashboardServer
 |                |                |                |                   |
 |-- click Apps ->|                |                |                   |
 |                |-- setView ---->|                |                   |
 |                |   ("apps")     |                |                   |
 |                |                |-- render ----->|                   |
 |                |                |                |                   |
 |                |                |                |-- GET /api/apps ->|
 |                |                |                |<-- [{name,slug}]--|
 |                |                |                |                   |
 |                |                |   [no apps]    |                   |
 |                |                |                |-- render empty    |
 |                |                |                |   state (R210)    |
 |                |                |                |                   |
 |                |                |   [has apps]   |                   |
 |                |                |                |-- render cards    |
 |                |                |                |                   |
 |-- click app -->|                |                |                   |
 |   (budget)     |                |                |                   |
 |                |-- setView ---->|                |                   |
 |                |  ("app:budget")|                |                   |
 |                |                |-- render ----->|                   |
 |                |                |   AppShell     |                   |
 |                |                |                |                   |
 |                |                |   AppShell:    |                   |
 |                |                |   GET /api/apps/budget/component ->|
 |                |                |   <-- JS module ------------------|
 |                |                |   dynamic import()                |
 |                |                |   render component                |
 |                |                |                |                   |
```

Notes:
- View type expands from 4 options to include "apps" (list) and "app:{slug}" (individual app)
- App components are cached after first import — subsequent visits skip the fetch
- Mobile: same sidebar behavior as other views (close on selection)
