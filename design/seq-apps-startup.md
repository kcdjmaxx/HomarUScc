# Sequence: App Registry Startup
**Requirements:** R197, R201, R204, R205

```
HomarUScc                    AppRegistry                  FileSystem
    |                            |                            |
    |-- new AppRegistry(dir) --->|                            |
    |                            |-- mkdirSync(dir) --------->|
    |                            |   (ensure exists, R205)    |
    |                            |                            |
    |-- scan() ---------------->|                            |
    |                            |-- readdirSync(dir) ------->|
    |                            |<-- [budget/, reading/] ----|
    |                            |                            |
    |                            |-- for each subdir:         |
    |                            |   readFileSync(manifest)-->|
    |                            |<-- manifest JSON ----------|
    |                            |-- validateManifest() -->   |
    |                            |   (skip invalid, R206)     |
    |                            |-- apps.set(slug, manifest) |
    |                            |                            |
    |-- startWatching() ------->|                            |
    |                            |-- chokidar.watch(dir) ---->|
    |                            |   pattern: */manifest.json |
    |                            |                            |
    |<-- ready -----------------|                            |
```

Notes:
- Startup is synchronous scan followed by async file watcher
- AppRegistry is initialized during HomarUScc constructor, after config is loaded
- Invalid manifests log a warning and are skipped
