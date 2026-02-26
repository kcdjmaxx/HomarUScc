# SkillsRegistry

**Requirements:** R401-R425

## Knows

- registrations: SkillRegistration[] — ordered list of all registered skills
- SkillRegistration: { id, name, icon, surface, order, core, component?, url?, description?, tools?, timers? }
- ViewProps: { messages, send }

## Does

- registerSkill(reg: SkillRegistration): void — appends to registrations array; called at module scope by each skill file as import side effect (R401, R404)
- getSidebarSkills(): SkillRegistration[] — returns `surface: "sidebar"` skills sorted by order (R401, R413)
- getAppsSkills(): SkillRegistration[] — returns `surface: "apps"` skills sorted by order (R401, R416)
- getHeadlessSkills(): SkillRegistration[] — returns `surface: "headless"` skills (R401, R424)
- getDefaultViewId(): string — returns id of the first core sidebar skill by order (Chat) (R417)

## Collaborators

- Chat, EventLog, StatusPanel, MemoryBrowser, KanbanView, CrmView, SpacesView: each calls registerSkill() with surface: "sidebar" at import time
- AppsView: calls registerSkill() with surface: "sidebar" (it renders other surface: "apps" skills within itself)
- AppInner (in App.tsx): calls getSidebarSkills() to build nav list and resolve active component
- Sidebar: receives filtered sidebar skill list as props (no direct dependency on SkillsRegistry)
- StatusPanel: can call getHeadlessSkills() to show background services

## Sequences

- seq-view-registration.md
