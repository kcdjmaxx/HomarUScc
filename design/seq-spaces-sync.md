# Sequence: Spaces Obsidian Bidirectional Sync

**Requirements:** R307, R308, R309, R340

## Initial Load (Startup)

```
Backend                   SpacesManager              Filesystem
    |                          |                         |
    |-- new SpacesManager() -->|                         |
    |                          |-- check dir exists ---->|
    |                          |   (if not, seedDefaults) |
    |                          |                         |
    |                          |-- loadTree() ---------->|
    |                          |   read dir recursively  |
    |                          |   parse _bucket.md files |
    |                          |   parse item .md files  |
    |                          |<- file contents --------|
    |                          |                         |
    |                          |-- build tree + idIndex  |
    |                          |                         |
    |                          |-- start watcher ------->|
    |                          |   watch spacesDir/**    |
    |                          |   ignore _root.md       |
    |<- ready -----------------|                         |
```

## External File Change (Obsidian Edit)

```
Obsidian                  Filesystem                SpacesManager           DashboardServer
    |                          |                         |                       |
    |-- save file.md --------->|                         |                       |
    |                          |-- change event -------->|                       |
    |                          |                         |-- debounce (300ms)    |
    |                          |                         |-- handleFileChange()  |
    |                          |                         |                       |
    |                          |                         |   if _bucket.md:      |
    |                          |                         |     re-parse bucket   |
    |                          |                         |     update tree node  |
    |                          |                         |                       |
    |                          |                         |   if item.md:         |
    |                          |                         |     re-parse item     |
    |                          |                         |     update tree node  |
    |                          |                         |                       |
    |                          |                         |   if new file:        |
    |                          |                         |     add to tree       |
    |                          |                         |     add to idIndex    |
    |                          |                         |                       |
    |                          |                         |   if deleted:         |
    |                          |                         |     remove from tree  |
    |                          |                         |     remove from index |
```

## Dashboard Write (Write-Then-Update)

```
SpacesView                DashboardServer           SpacesManager              Filesystem
    |                          |                         |                         |
    |-- PATCH item ----------->|                         |                         |
    |                          |-- updateItem() -------->|                         |
    |                          |                         |-- writeAtomic():        |
    |                          |                         |   write tmp file ------>|
    |                          |                         |   rename tmp -> real -->|
    |                          |                         |                         |
    |                          |                         |-- suppress watcher      |
    |                          |                         |   (ignore own write)    |
    |                          |                         |                         |
    |                          |                         |-- update cache          |
    |                          |<- updated item ---------|                         |
    |<- JSON ------------------|                         |                         |
```

## Seed Defaults (First Run)

```
SpacesManager              Filesystem
    |                         |
    |-- mkdir Spaces/ ------->|
    |-- write _root.md ------>|
    |                         |
    |-- mkdir fric-and-frac/ ->|
    |-- write _bucket.md ---->|
    |-- mkdir marketing/ ---->|
    |-- write _bucket.md ---->|
    |-- mkdir staffing/ ----->|
    |-- write _bucket.md ---->|
    |-- mkdir menu/ --------->|
    |-- write _bucket.md ---->|
    |-- mkdir operations/ --->|
    |-- write _bucket.md ---->|
    |                         |
    |-- mkdir miami-ice/ ---->|
    |-- write _bucket.md ---->|
    |                         |
    |-- mkdir personal/ ----->|
    |-- write _bucket.md ---->|
    |                         |
    |-- mkdir projects/ ----->|
    |-- write _bucket.md ---->|
    |-- mkdir homaruscc/ ---->|
    |-- write _bucket.md ---->|
    |-- mkdir ted-talk/ ----->|
    |-- write _bucket.md ---->|
```
