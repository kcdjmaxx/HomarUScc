# SpacesManager
**Requirements:** R301, R302, R303, R304, R305, R306, R307, R308, R309, R310, R311, R312, R313, R314, R315, R316, R317, R318, R330, R331, R333, R334, R335, R336, R337, R338, R339, R340, R343

## Knows
- spacesDir: string -- absolute path to the spaces directory on disk
- tree: SpaceTree -- in-memory cached tree of all buckets and items
- watcher: FSWatcher | null -- chokidar watcher for external file changes
- idIndex: Map<string, string> -- maps item/bucket IDs to their file paths for O(1) lookup

## Does
- constructor(spacesDir): initializes with configured path, loads tree, starts watcher
- loadTree(): reads directory recursively, parses _bucket.md and item .md files, builds nested tree
- getTree(): returns cached tree (R310)
- createBucket(opts): creates directory + _bucket.md, updates cache (R311)
- updateBucket(id, updates): patches _bucket.md frontmatter, updates cache (R312)
- deleteBucket(id): removes directory recursively, updates cache (R313)
- createItem(bucketId, opts): creates item .md file in bucket dir, updates cache (R314)
- updateItem(id, updates): patches item frontmatter/body, updates cache (R315)
- deleteItem(id): removes item file, updates cache (R316)
- moveItem(id, targetBucketId): moves file to target bucket dir, updates cache (R317)
- search(query): text search across all items matching title, body, tags, properties (R318)
- seedDefaults(): creates default bucket structure on first run (R306)
- slugify(name): converts name to filesystem-safe slug (R339)
- writeAtomic(path, content): writes to temp file then renames (R309)
- parseFrontmatter(content): extracts YAML frontmatter and body from markdown
- serializeFrontmatter(data, body): combines frontmatter and body into markdown string
- handleFileChange(path): invalidates cache entry and reloads affected file/bucket (R308)
- stop(): closes watcher

## Collaborators
- DashboardServer: registers API routes that delegate to SpacesManager methods
- Config: reads spaces.path from config.json (R305)

## Sequences
- seq-spaces-crud.md
- seq-spaces-sync.md
