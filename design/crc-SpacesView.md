# SpacesView
**Requirements:** R319, R320, R321, R322, R323, R324, R325, R326, R327, R328, R329, R332, R341, R342

## Knows
- tree: SpaceTree -- full tree fetched from /api/spaces/tree
- collapsed: Set<string> -- IDs of collapsed buckets
- search: string -- current search query
- editingItem: string | null -- ID of item being edited inline
- quickAdd: { bucketId: string, title: string } | null -- active quick-add state
- expandedItem: string | null -- ID of item with expanded body view

## Does
- fetchTree(): GET /api/spaces/tree, updates state (R310)
- renderBucketTree(bucket, depth): recursively renders buckets + items as collapsible tree (R320, R303)
- renderItem(item, bucket): renders item row with title, status chip, priority, due date, assignee (R320)
- renderStatusChip(item, bucket): clickable chip cycling through bucket statuses via PATCH (R321)
- renderDueDate(item): red if overdue, amber if within 2 days, normal otherwise (R322)
- handleQuickAdd(bucketId, title): POST new item with title only (R323)
- handleSearch(query): filters displayed items across all buckets (R324)
- handleInlineEdit(itemId, field, value): PATCH item inline (R325)
- handleDeleteItem(itemId): DELETE item immediately (R326)
- handleDeleteBucket(bucketId): two-click confirmation, then DELETE (R326)
- handleCheckboxToggle(itemId, lineIndex): updates checkbox in item body, PATCH to backend (R327)
- renderChatPanel(bucket): CrmChat-style panel scoped to current bucket (R328)
- renderAssignee(item): shows initial chip for max/caul (R332)
- renderMarkdown(md): renders markdown body with interactive checkboxes (R327)

## Collaborators
- DashboardServer: via REST API (/api/spaces/*)
- CrmChat pattern: reused for chat panel (R328)
- App.tsx: registers SpacesView in view switch (R329)
- Sidebar: adds "Spaces" entry with % icon (R329)

## Sequences
- seq-spaces-crud.md
