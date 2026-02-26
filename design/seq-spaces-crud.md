# Sequence: Spaces CRUD Operations

**Requirements:** R310, R311, R312, R313, R314, R315, R316, R317, R318, R323, R325, R326, R327

## Load Tree

```
SpacesView                DashboardServer           SpacesManager
    |                          |                         |
    |-- GET /api/spaces/tree ->|                         |
    |                          |-- getTree() ----------->|
    |                          |                         |-- return cached tree
    |                          |<- tree -----------------|
    |<- JSON tree -------------|                         |
    |-- setState(tree)         |                         |
```

## Create Bucket

```
SpacesView                DashboardServer           SpacesManager              Filesystem
    |                          |                         |                         |
    |-- POST /api/spaces/     |                         |                         |
    |   buckets {name,...} --->|                         |                         |
    |                          |-- createBucket(opts) -->|                         |
    |                          |                         |-- mkdir(slug) --------->|
    |                          |                         |-- writeAtomic(          |
    |                          |                         |     _bucket.md) ------->|
    |                          |                         |-- update cache          |
    |                          |<- bucket ---------------|                         |
    |<- JSON bucket -----------|                         |                         |
    |-- refetch tree           |                         |                         |
```

## Create Item (Quick Add)

```
SpacesView                DashboardServer           SpacesManager              Filesystem
    |                          |                         |                         |
    |-- POST /api/spaces/     |                         |                         |
    |   buckets/:id/items     |                         |                         |
    |   {title} ------------->|                         |                         |
    |                          |-- createItem(           |                         |
    |                          |     bucketId, opts) --->|                         |
    |                          |                         |-- generate ID           |
    |                          |                         |-- slugify title         |
    |                          |                         |-- writeAtomic(          |
    |                          |                         |     slug.md) ---------->|
    |                          |                         |-- update cache          |
    |                          |<- item -----------------|                         |
    |<- JSON item -------------|                         |                         |
    |-- refetch tree           |                         |                         |
```

## Update Item (Inline Edit / Status Cycle / Checkbox Toggle)

```
SpacesView                DashboardServer           SpacesManager              Filesystem
    |                          |                         |                         |
    |-- PATCH /api/spaces/    |                         |                         |
    |   items/:id             |                         |                         |
    |   {field: value} ------>|                         |                         |
    |                          |-- updateItem(           |                         |
    |                          |     id, updates) ----->|                         |
    |                          |                         |-- find path by ID       |
    |                          |                         |-- read current file     |
    |                          |                         |-- merge updates         |
    |                          |                         |-- writeAtomic(path) --->|
    |                          |                         |-- update cache          |
    |                          |<- updated item ---------|                         |
    |<- JSON item -------------|                         |                         |
    |-- update local state     |                         |                         |
```

## Delete Item

```
SpacesView                DashboardServer           SpacesManager              Filesystem
    |                          |                         |                         |
    |-- DELETE /api/spaces/   |                         |                         |
    |   items/:id ----------->|                         |                         |
    |                          |-- deleteItem(id) ----->|                         |
    |                          |                         |-- find path by ID       |
    |                          |                         |-- unlink(path) -------->|
    |                          |                         |-- update cache          |
    |                          |<- { ok: true } ---------|                         |
    |<- JSON ok ---------------|                         |                         |
    |-- refetch tree           |                         |                         |
```

## Delete Bucket (with confirmation)

```
SpacesView                DashboardServer           SpacesManager              Filesystem
    |                          |                         |                         |
    |-- user clicks delete     |                         |                         |
    |-- show confirm state     |                         |                         |
    |-- user confirms          |                         |                         |
    |-- DELETE /api/spaces/   |                         |                         |
    |   buckets/:id --------->|                         |                         |
    |                          |-- deleteBucket(id) --->|                         |
    |                          |                         |-- find dir by ID        |
    |                          |                         |-- rm -rf dir ---------->|
    |                          |                         |-- update cache          |
    |                          |<- { ok: true } ---------|                         |
    |<- JSON ok ---------------|                         |                         |
    |-- refetch tree           |                         |                         |
```

## Move Item

```
SpacesView                DashboardServer           SpacesManager              Filesystem
    |                          |                         |                         |
    |-- POST /api/spaces/     |                         |                         |
    |   items/:id/move        |                         |                         |
    |   {targetBucketId} ---->|                         |                         |
    |                          |-- moveItem(             |                         |
    |                          |     id, target) ------>|                         |
    |                          |                         |-- find source path      |
    |                          |                         |-- find target dir       |
    |                          |                         |-- rename(src, dst) ---->|
    |                          |                         |-- update cache          |
    |                          |<- moved item -----------|                         |
    |<- JSON item -------------|                         |                         |
    |-- refetch tree           |                         |                         |
```

## Search

```
SpacesView                DashboardServer           SpacesManager
    |                          |                         |
    |-- GET /api/spaces/      |                         |
    |   search?q=... -------->|                         |
    |                          |-- search(query) ------>|
    |                          |                         |-- iterate cached items
    |                          |                         |-- match title/body/tags
    |                          |<- results --------------|
    |<- JSON results ----------|                         |
    |-- display filtered       |                         |
```
