// CRC: crc-SpacesManager.md | Seq: seq-spaces-crud.md, seq-spaces-sync.md
// Manages Spaces directory tree: buckets as directories, items as markdown files
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, renameSync, rmSync, statSync, watch, type FSWatcher } from "node:fs";
import { join, basename, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

// R301: Bucket metadata stored in _bucket.md with YAML frontmatter
export interface BucketMeta {
  id: string;
  name: string;
  description?: string;
  statuses: string[];
  color?: string;
  sortOrder: number;
  properties: PropertyDef[];
  created: string;
  updated: string;
}

// R330: Custom property definitions per bucket
export interface PropertyDef {
  key: string;
  type: "text" | "url" | "number" | "date" | "select";
  label: string;
  options?: string[]; // for select type
}

// R302: Item stored as markdown with YAML frontmatter
export interface SpaceItem {
  id: string;
  title: string;
  body: string;
  status: string;
  priority: number;
  tags: string[];
  due?: string;
  assignee?: string;
  createdBy: string;
  created: string;
  updated: string;
  sortOrder: number;
  properties: Record<string, unknown>;
}

export interface SpaceBucket {
  meta: BucketMeta;
  items: SpaceItem[];
  children: SpaceBucket[];
  path: string; // absolute dir path
}

export interface SpaceTree {
  buckets: SpaceBucket[];
}

export class SpacesManager {
  private spacesDir: string;
  private tree: SpaceTree = { buckets: [] };
  private idIndex = new Map<string, string>(); // id -> absolute file path
  private bucketIdIndex = new Map<string, string>(); // bucket id -> absolute dir path
  private watcher: FSWatcher | null = null;
  private suppressedPaths = new Set<string>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(spacesDir: string) {
    this.spacesDir = spacesDir;
    this.ensureDir();
    this.loadTree();
    this.startWatcher();
  }

  // R340: Create spaces directory and seed defaults if needed
  private ensureDir(): void {
    if (!existsSync(this.spacesDir)) {
      mkdirSync(this.spacesDir, { recursive: true });
      this.seedDefaults();
    } else if (this.isDirEmpty()) {
      this.seedDefaults();
    }
  }

  private isDirEmpty(): boolean {
    const entries = readdirSync(this.spacesDir);
    return entries.length === 0;
  }

  // R306: Pre-seed default bucket structure
  private seedDefaults(): void {
    const now = new Date().toISOString();
    const defaults: Array<{ path: string; name: string; color?: string; description?: string; sortOrder: number }> = [
      { path: "fric-and-frac", name: "Fric & Frac", color: "#4ade80", description: "Restaurant operations and projects", sortOrder: 0 },
      { path: "fric-and-frac/marketing", name: "Marketing", description: "Campaign ideas, seasonal plans", sortOrder: 0 },
      { path: "fric-and-frac/staffing", name: "Staffing", description: "Hiring, schedules, training", sortOrder: 1 },
      { path: "fric-and-frac/menu", name: "Menu", description: "New items, vendor notes, seasonal changes", sortOrder: 2 },
      { path: "fric-and-frac/operations", name: "Operations", description: "Equipment, repairs, vendor follow-ups", sortOrder: 3 },
      { path: "miami-ice", name: "Miami Ice", color: "#60a5fa", description: "Miami Ice venture", sortOrder: 1 },
      { path: "personal", name: "Personal", color: "#f59e0b", description: "Non-business items", sortOrder: 2 },
      { path: "projects", name: "Projects", color: "#c4b5fd", description: "Technical and creative work", sortOrder: 3 },
      { path: "projects/homaruscc", name: "HomarUScc", description: "Feature ideas, bugs, improvements", sortOrder: 0 },
      { path: "projects/ted-talk", name: "TED Talk", description: "Presentation prep, research", sortOrder: 1 },
    ];

    for (const d of defaults) {
      const dirPath = join(this.spacesDir, d.path);
      mkdirSync(dirPath, { recursive: true });
      const slug = d.path.split("/").pop()!;
      const meta: BucketMeta = {
        id: `bucket-${slug}`,
        name: d.name,
        description: d.description,
        statuses: ["open", "doing", "done"],
        color: d.color,
        sortOrder: d.sortOrder,
        properties: [],
        created: now,
        updated: now,
      };
      writeFileSync(join(dirPath, "_bucket.md"), this.serializeBucketMeta(meta));
    }
  }

  // R307: Load full tree into memory
  private loadTree(): void {
    this.idIndex.clear();
    this.bucketIdIndex.clear();
    this.tree = { buckets: this.loadBucketsFromDir(this.spacesDir) };
  }

  private loadBucketsFromDir(dir: string): SpaceBucket[] {
    const buckets: SpaceBucket[] = [];
    if (!existsSync(dir)) return buckets;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue;

      const bucketDir = join(dir, entry.name);
      const metaPath = join(bucketDir, "_bucket.md");
      if (!existsSync(metaPath)) continue;

      try {
        const content = readFileSync(metaPath, "utf8");
        const meta = this.parseBucketMeta(content, entry.name);
        this.bucketIdIndex.set(meta.id, bucketDir);

        const items = this.loadItemsFromDir(bucketDir);
        const children = this.loadBucketsFromDir(bucketDir);

        buckets.push({ meta, items, children, path: bucketDir });
      } catch {
        // Skip invalid bucket
      }
    }

    buckets.sort((a, b) => a.meta.sortOrder - b.meta.sortOrder);
    return buckets;
  }

  private loadItemsFromDir(dir: string): SpaceItem[] {
    const items: SpaceItem[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      if (entry.name === "_bucket.md" || entry.name === "_root.md") continue;

      try {
        const filePath = join(dir, entry.name);
        const content = readFileSync(filePath, "utf8");
        const item = this.parseItem(content, entry.name);
        this.idIndex.set(item.id, filePath);
        items.push(item);
      } catch {
        // Skip invalid items
      }
    }
    items.sort((a, b) => a.sortOrder - b.sortOrder);
    return items;
  }

  // R310: Return cached tree
  getTree(): SpaceTree {
    return this.tree;
  }

  // R311: Create bucket
  createBucket(opts: {
    name: string;
    parentId?: string;
    description?: string;
    statuses?: string[];
    color?: string;
    properties?: PropertyDef[];
  }): BucketMeta {
    const slug = this.slugify(opts.name);
    let parentDir = this.spacesDir;
    if (opts.parentId) {
      const pd = this.bucketIdIndex.get(opts.parentId);
      if (!pd) throw new Error(`Parent bucket not found: ${opts.parentId}`);
      parentDir = pd;
    }

    const dirPath = join(parentDir, slug);
    if (existsSync(dirPath)) throw new Error(`Bucket directory already exists: ${slug}`);

    const now = new Date().toISOString();
    const meta: BucketMeta = {
      id: `bucket-${slug}`,
      name: opts.name,
      description: opts.description,
      statuses: opts.statuses ?? ["open", "done"],
      color: opts.color,
      sortOrder: 999,
      properties: opts.properties ?? [],
      created: now,
      updated: now,
    };

    mkdirSync(dirPath, { recursive: true });
    this.writeAtomic(join(dirPath, "_bucket.md"), this.serializeBucketMeta(meta));
    this.bucketIdIndex.set(meta.id, dirPath);

    // Reload tree to update cache
    this.loadTree();
    return meta;
  }

  // R312: Update bucket
  updateBucket(id: string, updates: Partial<BucketMeta>): BucketMeta {
    const dirPath = this.bucketIdIndex.get(id);
    if (!dirPath) throw new Error(`Bucket not found: ${id}`);

    const metaPath = join(dirPath, "_bucket.md");
    const content = readFileSync(metaPath, "utf8");
    const current = this.parseBucketMeta(content, basename(dirPath));

    const updated: BucketMeta = {
      ...current,
      ...updates,
      id: current.id, // don't allow ID change
      updated: new Date().toISOString(),
    };

    this.writeAtomic(metaPath, this.serializeBucketMeta(updated));
    this.loadTree();
    return updated;
  }

  // R313: Delete bucket and all contents
  deleteBucket(id: string): void {
    const dirPath = this.bucketIdIndex.get(id);
    if (!dirPath) throw new Error(`Bucket not found: ${id}`);

    rmSync(dirPath, { recursive: true, force: true });
    this.loadTree();
  }

  // R314: Create item in bucket
  createItem(bucketId: string, opts: {
    title: string;
    body?: string;
    status?: string;
    priority?: number;
    tags?: string[];
    due?: string;
    assignee?: string;
    createdBy?: string;
    properties?: Record<string, unknown>;
  }): SpaceItem {
    const dirPath = this.bucketIdIndex.get(bucketId);
    if (!dirPath) throw new Error(`Bucket not found: ${bucketId}`);

    // R343: Generate item ID
    const id = `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    // Get bucket meta for default status
    const metaPath = join(dirPath, "_bucket.md");
    const bucketContent = readFileSync(metaPath, "utf8");
    const bucketMeta = this.parseBucketMeta(bucketContent, basename(dirPath));

    // Count existing items for sortOrder
    const existingItems = this.loadItemsFromDir(dirPath);
    const maxSort = existingItems.reduce((max, i) => Math.max(max, i.sortOrder), -1);

    const item: SpaceItem = {
      id,
      title: opts.title,
      body: opts.body ?? "",
      status: opts.status ?? bucketMeta.statuses[0] ?? "open",
      priority: opts.priority ?? 0,
      tags: opts.tags ?? [],
      due: opts.due,
      assignee: opts.assignee,
      createdBy: opts.createdBy ?? "max",
      created: now,
      updated: now,
      sortOrder: maxSort + 1,
      properties: opts.properties ?? {},
    };

    // R339: Slugify title for filename, handle collisions
    let slug = this.slugify(opts.title);
    let filePath = join(dirPath, `${slug}.md`);
    let counter = 2;
    while (existsSync(filePath)) {
      filePath = join(dirPath, `${slug}-${counter}.md`);
      counter++;
    }

    this.writeAtomic(filePath, this.serializeItem(item));
    this.idIndex.set(id, filePath);
    this.loadTree();
    return item;
  }

  // R315: Update item
  updateItem(id: string, updates: Partial<SpaceItem>): SpaceItem {
    const filePath = this.idIndex.get(id);
    if (!filePath) throw new Error(`Item not found: ${id}`);

    const content = readFileSync(filePath, "utf8");
    const current = this.parseItem(content, basename(filePath));

    const updated: SpaceItem = {
      ...current,
      ...updates,
      id: current.id, // preserve ID
      updated: new Date().toISOString(),
    };

    this.writeAtomic(filePath, this.serializeItem(updated));
    this.loadTree();
    return updated;
  }

  // R316: Delete item
  deleteItem(id: string): void {
    const filePath = this.idIndex.get(id);
    if (!filePath) throw new Error(`Item not found: ${id}`);

    if (existsSync(filePath)) unlinkSync(filePath);
    this.idIndex.delete(id);
    this.loadTree();
  }

  // Reorder item within its bucket
  reorderItem(id: string, direction: "up" | "down"): void {
    const filePath = this.idIndex.get(id);
    if (!filePath) throw new Error(`Item not found: ${id}`);

    const bucketDir = dirname(filePath);
    const items = this.loadItemsFromDir(bucketDir);
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;

    // Swap sortOrder values
    const myOrder = items[idx].sortOrder;
    const theirOrder = items[swapIdx].sortOrder;

    // Update both items on disk
    const myPath = this.idIndex.get(items[idx].id)!;
    const theirPath = this.idIndex.get(items[swapIdx].id)!;

    const myContent = readFileSync(myPath, "utf8");
    const myItem = this.parseItem(myContent, basename(myPath));
    myItem.sortOrder = theirOrder;
    this.writeAtomic(myPath, this.serializeItem(myItem));

    const theirContent = readFileSync(theirPath, "utf8");
    const theirItem = this.parseItem(theirContent, basename(theirPath));
    theirItem.sortOrder = myOrder;
    this.writeAtomic(theirPath, this.serializeItem(theirItem));

    this.loadTree();
  }

  // R317: Move item to different bucket
  moveItem(id: string, targetBucketId: string): SpaceItem {
    const filePath = this.idIndex.get(id);
    if (!filePath) throw new Error(`Item not found: ${id}`);

    const targetDir = this.bucketIdIndex.get(targetBucketId);
    if (!targetDir) throw new Error(`Target bucket not found: ${targetBucketId}`);

    const fileName = basename(filePath);
    let targetPath = join(targetDir, fileName);
    let counter = 2;
    while (existsSync(targetPath)) {
      const base = fileName.replace(/\.md$/, "");
      targetPath = join(targetDir, `${base}-${counter}.md`);
      counter++;
    }

    renameSync(filePath, targetPath);
    this.idIndex.set(id, targetPath);
    this.loadTree();

    const content = readFileSync(targetPath, "utf8");
    return this.parseItem(content, basename(targetPath));
  }

  // R318: Search items across all buckets
  search(query: string): Array<SpaceItem & { bucketId: string; bucketName: string }> {
    const q = query.toLowerCase();
    const results: Array<SpaceItem & { bucketId: string; bucketName: string }> = [];
    this.searchBuckets(this.tree.buckets, q, results);
    return results;
  }

  private searchBuckets(
    buckets: SpaceBucket[],
    q: string,
    results: Array<SpaceItem & { bucketId: string; bucketName: string }>
  ): void {
    for (const bucket of buckets) {
      for (const item of bucket.items) {
        if (
          item.title.toLowerCase().includes(q) ||
          item.body.toLowerCase().includes(q) ||
          item.tags.some(t => t.toLowerCase().includes(q)) ||
          Object.values(item.properties).some(v => String(v).toLowerCase().includes(q))
        ) {
          results.push({ ...item, bucketId: bucket.meta.id, bucketName: bucket.meta.name });
        }
      }
      this.searchBuckets(bucket.children, q, results);
    }
  }

  // R333: List all buckets with item counts (for MCP tool)
  listBuckets(): Array<{ id: string; name: string; itemCount: number; children: Array<{ id: string; name: string; itemCount: number }> }> {
    return this.tree.buckets.map(b => this.summarizeBucket(b));
  }

  private summarizeBucket(bucket: SpaceBucket): { id: string; name: string; itemCount: number; children: Array<{ id: string; name: string; itemCount: number }> } {
    return {
      id: bucket.meta.id,
      name: bucket.meta.name,
      itemCount: bucket.items.length,
      children: bucket.children.map(c => this.summarizeBucket(c) as { id: string; name: string; itemCount: number; children: Array<{ id: string; name: string; itemCount: number }> }),
    };
  }

  // R334: Get bucket details + items
  getBucket(id: string, recursive = false): { meta: BucketMeta; items: SpaceItem[]; children?: SpaceBucket[] } | null {
    const bucket = this.findBucket(id, this.tree.buckets);
    if (!bucket) return null;
    return {
      meta: bucket.meta,
      items: bucket.items,
      children: recursive ? bucket.children : undefined,
    };
  }

  private findBucket(id: string, buckets: SpaceBucket[]): SpaceBucket | null {
    for (const b of buckets) {
      if (b.meta.id === id) return b;
      const found = this.findBucket(id, b.children);
      if (found) return found;
    }
    return null;
  }

  // R308: Watch for external changes
  private startWatcher(): void {
    try {
      this.watcher = watch(this.spacesDir, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        const fullPath = join(this.spacesDir, filename);

        // Suppress events from our own writes
        if (this.suppressedPaths.has(fullPath)) return;

        // Debounce to avoid rapid reloads
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.loadTree();
        }, 300);
      });
    } catch {
      // watch not supported or other error -- silently degrade
    }
  }

  // R309: Atomic write
  private writeAtomic(filePath: string, content: string): void {
    const tmpPath = join(tmpdir(), `spaces-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.tmp`);
    this.suppressedPaths.add(filePath);
    try {
      writeFileSync(tmpPath, content);
      renameSync(tmpPath, filePath);
    } finally {
      // Remove suppression after a short delay to catch the watch event
      setTimeout(() => this.suppressedPaths.delete(filePath), 500);
    }
  }

  // R339: Slugify name for filesystem
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      || "untitled";
  }

  // --- Frontmatter parsing ---

  private parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: content };

    const fm: Record<string, unknown> = {};
    let currentKey = "";
    let inArray = false;
    const arrayItems: unknown[] = [];

    for (const line of match[1].split("\n")) {
      // Array item continuation
      if (inArray && line.match(/^\s+-\s/)) {
        const val = line.replace(/^\s+-\s/, "").trim();
        // Try to parse as object (key: value within array item)
        if (val.startsWith("{") || val.includes(":")) {
          try { arrayItems.push(JSON.parse(val)); } catch { arrayItems.push(val); }
        } else {
          arrayItems.push(val);
        }
        continue;
      } else if (inArray) {
        fm[currentKey] = arrayItems.slice();
        arrayItems.length = 0;
        inArray = false;
      }

      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;

      const key = line.slice(0, colonIdx).trim();
      const rawVal = line.slice(colonIdx + 1).trim();

      if (rawVal === "" || rawVal === undefined) {
        // Could be start of array
        currentKey = key;
        inArray = true;
        continue;
      }

      // Try JSON parse for arrays/objects
      if ((rawVal.startsWith("[") && rawVal.endsWith("]")) || (rawVal.startsWith("{") && rawVal.endsWith("}"))) {
        try { fm[key] = JSON.parse(rawVal); continue; } catch { /* fall through */ }
      }

      // Boolean
      if (rawVal === "true") { fm[key] = true; continue; }
      if (rawVal === "false") { fm[key] = false; continue; }

      // Number
      if (/^-?\d+(\.\d+)?$/.test(rawVal)) { fm[key] = Number(rawVal); continue; }

      // Strip quotes
      if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
        fm[key] = rawVal.slice(1, -1);
        continue;
      }

      fm[key] = rawVal;
    }

    if (inArray) {
      fm[currentKey] = arrayItems.slice();
    }

    return { frontmatter: fm, body: match[2].trim() };
  }

  private parseBucketMeta(content: string, dirName: string): BucketMeta {
    const { frontmatter: fm } = this.parseFrontmatter(content);
    return {
      id: (fm.id as string) ?? `bucket-${dirName}`,
      name: (fm.name as string) ?? dirName,
      description: fm.description as string | undefined,
      statuses: Array.isArray(fm.statuses) ? fm.statuses as string[] : ["open", "done"],
      color: fm.color as string | undefined,
      sortOrder: typeof fm.sortOrder === "number" ? fm.sortOrder : 999,
      properties: Array.isArray(fm.properties) ? fm.properties as PropertyDef[] : [],
      created: (fm.created as string) ?? new Date().toISOString(),
      updated: (fm.updated as string) ?? new Date().toISOString(),
    };
  }

  private parseItem(content: string, fileName: string): SpaceItem {
    const { frontmatter: fm, body } = this.parseFrontmatter(content);

    // Extract title from first # heading in body, or from filename
    let title = fileName.replace(/\.md$/, "").replace(/-/g, " ");
    const headingMatch = body.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      title = headingMatch[1];
    }

    // Body is everything after the first heading
    let itemBody = body;
    if (headingMatch) {
      const idx = body.indexOf(headingMatch[0]);
      itemBody = body.slice(idx + headingMatch[0].length).trim();
    }

    return {
      id: (fm.id as string) ?? `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      body: itemBody,
      status: (fm.status as string) ?? "open",
      priority: typeof fm.priority === "number" ? fm.priority : 0,
      tags: Array.isArray(fm.tags) ? fm.tags as string[] : [],
      due: fm.due as string | undefined,
      assignee: fm.assignee as string | undefined,
      createdBy: (fm.createdBy as string) ?? "max",
      created: (fm.created as string) ?? new Date().toISOString(),
      updated: (fm.updated as string) ?? new Date().toISOString(),
      sortOrder: typeof fm.sortOrder === "number" ? fm.sortOrder : 999,
      properties: (fm.properties as Record<string, unknown>) ?? {},
    };
  }

  private serializeBucketMeta(meta: BucketMeta): string {
    const lines = [
      "---",
      `id: ${meta.id}`,
      `name: ${meta.name}`,
    ];
    if (meta.description) lines.push(`description: ${meta.description}`);
    lines.push(`statuses: ${JSON.stringify(meta.statuses)}`);
    if (meta.color) lines.push(`color: "${meta.color}"`);
    lines.push(`sortOrder: ${meta.sortOrder}`);
    if (meta.properties.length > 0) {
      lines.push(`properties: ${JSON.stringify(meta.properties)}`);
    } else {
      lines.push("properties: []");
    }
    lines.push(`created: ${meta.created}`);
    lines.push(`updated: ${meta.updated}`);
    lines.push("---\n");
    return lines.join("\n");
  }

  private serializeItem(item: SpaceItem): string {
    const lines = [
      "---",
      `id: ${item.id}`,
      `status: ${item.status}`,
      `priority: ${item.priority}`,
      `tags: ${JSON.stringify(item.tags)}`,
    ];
    if (item.due) lines.push(`due: ${item.due}`);
    if (item.assignee) lines.push(`assignee: ${item.assignee}`);
    lines.push(`createdBy: ${item.createdBy}`);
    lines.push(`created: ${item.created}`);
    lines.push(`updated: ${item.updated}`);
    lines.push(`sortOrder: ${item.sortOrder}`);
    if (Object.keys(item.properties).length > 0) {
      lines.push(`properties: ${JSON.stringify(item.properties)}`);
    }
    lines.push("---");
    lines.push("");
    lines.push(`# ${item.title}`);
    if (item.body) {
      lines.push("");
      lines.push(item.body);
    }
    lines.push("");
    return lines.join("\n");
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
