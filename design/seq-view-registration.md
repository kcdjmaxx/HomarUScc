# Sequence: Skill Registration, Sidebar Render, View Switch

**Requirements:** R401-R425

## Phase 1: Module Import & Self-Registration

Triggered when App.tsx is loaded by the browser (Vite bundles all imports).

```
App.tsx                    skills-registry.ts           Chat.tsx (and 7 others)
  |                              |                              |
  |--- import Chat ------------->|                              |
  |                              |<-- registerSkill(Chat) ------|
  |                              |    { id:"chat", name:"Chat", |
  |                              |      icon:">", order:10,     |
  |                              |      surface:"sidebar",      |
  |                              |      core:true,              |
  |                              |      component:Chat }        |
  |                              |                              |
  |--- import EventLog --------->|                              |
  |                              |<-- registerSkill(EventLog) --|
  |                              |    { id:"events", order:20,  |
  |                              |      surface:"sidebar",      |
  |                              |      core:true, ... }        |
  |                              |                              |
  | ... (repeat for all 8        |                              |
  |  sidebar skills)             |                              |
  |                              |                              |
  | registrations array now has  |                              |
  | 8 sidebar entries, unsorted  |                              |
```

## Phase 2: Frontend Startup & Config Fetch

Triggered when AppInner mounts.

```
AppInner                   skills-registry.ts        Backend /api/config/skills
  |                              |                              |
  |--- getSidebarSkills() ----->|                              |
  |<-- [8 SkillRegistrations] --|  (sorted by order)           |
  |                              |                              |
  |--- fetch /api/config/skills ------------------------------>|
  |<-- { "kanban": false } ------------------------------------|
  |                              |                              |
  | Filter: keep all core skills |                              |
  |   + non-core where config    |                              |
  |     is not explicitly false  |                              |
  |                              |                              |
  | Result: 7 sidebar skills     |                              |
  |   (Kanban removed)           |                              |
  |                              |                              |
  | Set view state = "chat"      |                              |
  |   (getDefaultViewId())       |                              |
  |                              |                              |
  |--- pass filtered skills      |                              |
  |    to <Sidebar />            |                              |
```

## Phase 3: Sidebar Render

Sidebar receives filtered sidebar skills as props instead of hardcoded array.

```
AppInner                   Sidebar
  |                              |
  |--- render Sidebar            |
  |    props:                    |
  |      skills: SkillRegistration[]
  |      activeView: "chat"      |
  |      onViewChange: fn        |
  |      connected: boolean      |
  |                              |
  |                              |--- map skills to nav buttons
  |                              |    (same styling as before)
  |                              |    each button: icon + name
  |                              |    active highlight on match
  |                              |
```

## Phase 4: View Switch

User clicks a sidebar item.

```
User                       Sidebar              AppInner             skills-registry.ts
  |                              |                    |                      |
  |--- click "Spaces" --------->|                    |                      |
  |                              |--- onViewChange   |                      |
  |                              |    ("spaces") --->|                      |
  |                              |                    |--- find skill by id  |
  |                              |                    |    in filtered list   |
  |                              |                    |                      |
  |                              |                    | skill.component =    |
  |                              |                    |   SpacesView         |
  |                              |                    |                      |
  |                              |                    |--- render            |
  |                              |                    | <SpacesView          |
  |                              |                    |   messages={msgs}    |
  |                              |                    |   send={send} />     |
  |                              |                    |                      |
```

## Phase 5: Apps Page Render

AppsView renders external skills from registry.

```
AppsView                   skills-registry.ts
  |                              |
  |--- getAppsSkills() -------->|
  |<-- [external skills] -------|
  |                              |
  | Render each as card/tile:    |
  |   name, icon, description    |
  |   link/iframe to skill.url   |
  |                              |
```

## Phase 6: Config-Disabled View Fallback

If active view becomes disabled (e.g., config hot-reload removes it).

```
AppInner                   skills-registry.ts
  |                              |
  | (after re-fetch of config)   |
  | active view "kanban" is no   |
  | longer in filtered list      |
  |                              |
  |--- getDefaultViewId() ------>|
  |<-- "chat" ------------------|
  |                              |
  | Set view state = "chat"      |
  |                              |
```
