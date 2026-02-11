# Obsidian Things: Bidirectional Things 3 Integration

## Overview

An Obsidian plugin that provides true two-way sync between Obsidian and Things 3. Tasks tagged with a configurable tag (default `#things`) in Obsidian checkboxes sync bidirectionally with Things 3 — creating, completing, reopening, and modifying tasks in both directions. A query DSL renders live task views (lists, kanban boards, tables) inside notes.

**Platform:** macOS desktop only. Things 3 has no cross-platform read API.

**Integration methods:**
- **Read from Things:** SQLite database (read-only, safe, fast)
- **Write to Things:** AppleScript via `osascript` (silent background execution, no window activation, no auth token required)

## Why AppleScript Over URL Scheme

The URL scheme (`things:///update`) was considered but rejected for the sync engine:

- URL scheme **activates the Things window** on every call — unacceptable for background polling every 30 seconds
- URL scheme requires an `auth-token` for all update operations
- URL scheme cannot reliably reopen tasks (`completed=false` is undocumented)
- URL scheme is rate-limited to 250 items per 10 seconds
- URL scheme cannot read data at all

AppleScript runs silently, supports `set status to open` for reopening, needs no auth token, and has no rate limits. Since SQLite reading already requires macOS, AppleScript for writes doesn't reduce platform reach.

## Architecture

Five components:

### 1. Sync Engine

A background timer (`registerInterval`) running every N seconds (configurable, default 30s). Orchestrates the sync loop: read Things DB, scan vault, reconcile, write changes, update state.

### 2. Things Reader

Spawns `sqlite3` in read-only mode against the Things database:

```
~/Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac/ThingsData-*/Things Database.thingsdatabase/main.sqlite
```

Queries `TMTask` joined with `TMTaskTag`, `TMTag`, `TMArea`, and `TMChecklistItem`. Pulls all non-trashed tasks modified since last sync. Parses Things' custom binary date encoding for `startDate`/`deadline` fields (bit-packed `YYYYYYYYYYYMMMMDDDDD0000000` format). Results cached in memory keyed by UUID.

Auto-discovers the database path by scanning the `ThingsData-*` glob. Supports manual override in settings.

### 3. Things Writer

Executes AppleScript via `child_process.spawn('osascript', [...])`. Operations:

| Operation | AppleScript |
|-----------|-------------|
| Create task | `make new to do with properties {name:"...", notes:"...", due date:date "..."}` |
| Complete task | `set status of to do id "UUID" to completed` |
| Reopen task | `set status of to do id "UUID" to open` |
| Update title | `set name of to do id "UUID" to "..."` |
| Move to project | `set project of to do id "UUID" to project "Name"` |
| Set tags | `set tag names of to do id "UUID" to "tag1, tag2"` |

### 4. Markdown Scanner

Scans vault files for checkboxes matching the configured sync tag. Regex pattern:

```
- \[([ x])\] (.+?)#things(.*?)(?:%%things:([A-F0-9-]+)%%)?$
```

(Tag name is configurable — `#things` is the default.)

For each match, extracts: checked state, task text, and the hidden UUID from `%%things:UUID%%` (Obsidian comment syntax, invisible in reading view).

### 5. Code Block Renderer

Registers a `things` code block processor via `registerMarkdownCodeBlockProcessor`. Parses a query DSL, fetches matching tasks from the in-memory cache, and renders interactive views. No extra DB reads on render.

## Sync Loop

On each tick (every N seconds):

**Step 1 — Read Things DB.** Query tasks with `userModificationDate` newer than last sync timestamp. Cache results in memory.

**Step 2 — Scan vault.** Find all tagged checkboxes. Extract UUID and checked state for each.

**Step 3 — Reconcile.** Six cases:

| Case | Detection | Action |
|------|-----------|--------|
| New in Obsidian | Tagged checkbox, no `%%things:UUID%%` | Create task in Things via AppleScript. Write UUID back: `%%things:UUID%%` |
| Completed in Obsidian | `[ ]` -> `[x]`, UUID exists | `set status to completed` via AppleScript |
| Reopened in Obsidian | `[x]` -> `[ ]`, UUID exists | `set status to open` via AppleScript |
| Completed in Things | DB status=3, Obsidian still `[ ]` | Toggle to `[x]` via `vault.process()` |
| Reopened in Things | DB status=0, Obsidian still `[x]` | Toggle to `[ ]` via `vault.process()` |
| Modified in Things | Title/dates changed since last sync | Update checkbox text in Obsidian |

**Step 4 — Update sync state.** Write current timestamp and per-task state to `sync-state.json`.

### Sync State

`sync-state.json` stores per-task tracking:

```json
{
  "lastSyncTimestamp": 1707600000,
  "tasks": {
    "UUID-1": {
      "filePath": "notes/project.md",
      "line": 42,
      "checked": false,
      "title": "Call dentist",
      "lastSyncTimestamp": 1707600000
    }
  }
}
```

The `checked` field enables detecting transitions (`[ ]` -> `[x]` and `[x]` -> `[ ]`).

### Conflict Resolution

If both sides changed since last sync, a configurable rule applies (default: Things wins). The Obsidian line gets overwritten to match Things state.

## Task Format

A synced task in a note looks like:

```markdown
- [ ] Call dentist #things %%things:A1B2C3D4-E5F6-7890-ABCD-EF1234567890%%
```

- `- [ ]` / `- [x]` — standard markdown checkbox
- `Call dentist` — task title (synced with Things)
- `#things` — configurable sync tag (marks this checkbox for sync)
- `%%things:UUID%%` — hidden comment (invisible in reading view), links to Things task

Optional visible metadata (controlled by settings):

```markdown
- [ ] Call dentist #things (Health) 📅 2026-03-01 %%things:UUID%%
```

Where `(Health)` is the project name and `📅 2026-03-01` is the deadline.

### Creating a Task

Write a tagged checkbox in any note:

```markdown
- [ ] Buy groceries #things
```

The next sync cycle detects it (no UUID present), creates it in Things via AppleScript, and rewrites the line with the UUID:

```markdown
- [ ] Buy groceries #things %%things:A1B2C3D4-...%%
```

## Query DSL

Fenced code blocks with the `things` language tag render live task views.

### Syntax

One filter per line. All filters are optional and composable.

````
```things
today
```
````

````
```things
project: Work Stuff
status: open
tag: urgent
sort: deadline
```
````

### Filters

| Filter | Example | Description |
|--------|---------|-------------|
| `today` | `today` | Tasks scheduled for today |
| `inbox` | `inbox` | Inbox tasks |
| `upcoming` | `upcoming` | Upcoming scheduled tasks |
| `someday` | `someday` | Someday tasks |
| `logbook` | `logbook` | Completed tasks |
| `project: Name` | `project: Work Stuff` | Tasks in a specific project |
| `area: Name` | `area: Personal` | Tasks in a specific area |
| `tag: Name` | `tag: urgent` | Tasks with a specific tag |
| `status: open\|completed\|canceled` | `status: open` | Filter by status |
| `deadline: before\|after\|today` | `deadline: before 2026-03-01` | Deadline filtering |
| `sort: field` | `sort: deadline` | Sort by deadline, project, area, title |
| `limit: N` | `limit: 20` | Cap result count |
| `group: field` | `group: project` | Group by project, area, or tag |
| `view: list\|kanban\|table` | `view: kanban` | Rendering mode |

### Views

**`list`** (default) — Vertical grouped lists with headers. Each task is an interactive checkbox with title, project (dimmed), and deadline.

**`kanban`** — Horizontal columns, one per `group` value. e.g. `group: project, view: kanban` renders one column per project. Tasks with multiple tags appear in multiple columns when grouped by tag.

**`table`** — Rows with columns for title, project, area, deadline, tags, status.

### Interactivity

Checking a task checkbox in any view fires the AppleScript write path immediately (does not wait for the next poll cycle). The in-memory cache is updated optimistically.

## Settings

### Connection

| Setting | Default | Description |
|---------|---------|-------------|
| Things database path | Auto-detected | Override for non-standard installs. Auto-discovers by scanning `~/Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac/ThingsData-*/` |
| Sync interval | 30 seconds | Poll frequency. Range: 10s-300s |
| Sync on startup | `true` | Run full sync when Obsidian launches |

### Task Format

| Setting | Default | Description |
|---------|---------|-------------|
| Sync tag | `#things` | Tag that marks a checkbox for sync. Configurable to `#task`, `#t3`, etc. |
| Show project in tasks | `true` | Append `(Project Name)` dimmed after task title |
| Show deadline in tasks | `true` | Append deadline date after task title |
| Show area in tasks | `false` | Append area name |

### Sync Behavior

| Setting | Default | Description |
|---------|---------|-------------|
| Conflict resolution | Things wins | When both sides changed: `Things wins` or `Obsidian wins` |
| Sync completed tasks | `true` | Sync status changes for completed items |
| Auto-create in Things | `true` | Automatically push new tagged checkboxes to Things. If false, requires explicit command |
| Default project | Inbox | Where new Obsidian-created tasks land in Things |
| Default tags | (empty) | Tags auto-applied to tasks created from Obsidian |

### Advanced

| Setting | Default | Description |
|---------|---------|-------------|
| Debug logging | `false` | Log sync operations to console |
| Dry run mode | `false` | Show what sync would do without writing. Useful for first-time setup |

## Existing Plugin Landscape

Every existing plugin is stale and single-purpose:

| Plugin | Downloads | Rating | Last Updated | Limitation |
|--------|-----------|--------|-------------|------------|
| Things3 Sync | 14,601 | 58/100 | 2 years ago | Push-only via URL scheme. No read. |
| Things Logbook | 10,425 | 45/100 | 2 years ago | Completed tasks only. One-way. |
| Things Link | 7,168 | 40/100 | 4 years ago | Deep links only. No sync. |
| Things3 Today | 2,560 | 46/100 | 2 years ago | Read-only sidebar. Today list only. |

None offer bidirectional sync, inline task management, or query/reporting. Combined 35K+ downloads indicate strong demand despite mediocre quality.

## Technical References

### Things 3 SQLite Schema

| Table | Purpose |
|-------|---------|
| `TMTask` | Tasks, projects, headings (type: 0=todo, 1=project, 2=heading) |
| `TMArea` | Areas |
| `TMTag` | Tags |
| `TMTaskTag` | Task-to-tag junction table |
| `TMChecklistItem` | Checklist items within tasks |

Key `TMTask` columns: `uuid`, `title`, `type`, `status` (0=open, 2=canceled, 3=completed), `trashed`, `start` (0=Inbox, 1=Anytime, 2=Someday), `startDate`, `deadline`, `notes`, `project`, `area`, `creationDate`, `userModificationDate`, `stopDate`.

Date fields use bit-packed binary encoding: `YYYYYYYYYYYMMMMDDDDD0000000`.

### Things 3 AppleScript Dictionary

Classes: `to do`, `project`, `area`, `tag`, `list` (Inbox, Today, Anytime, Upcoming, Someday, Logbook, Trash).

Read/write properties on `to do`: `name`, `notes`, `due date`, `status` (open/completed/canceled), `tag names`, `project`, `area`, `completion date`, `cancellation date`.

Read-only: `creation date`, `modification date`.

### Obsidian Plugin APIs Used

- `registerInterval()` — background sync timer
- `child_process.spawn()` — SQLite reads and AppleScript execution
- `registerMarkdownCodeBlockProcessor()` — query DSL rendering
- `vault.process()` — atomic file modifications for checkbox toggling
- `vault.on('modify')` — detect Obsidian-side changes between poll cycles
- `Platform.isMacOS && Platform.isDesktopApp` — platform gate

## Scope

### MVP

- Poll-based bidirectional sync (create, complete, reopen)
- Configurable sync tag
- `things` code blocks with list view
- Core filters: today, inbox, project, area, tag, status, sort, limit
- Settings panel

### Post-MVP

- Kanban view (`view: kanban`)
- Table view (`view: table`)
- `group` filter
- Drag-and-drop between kanban columns
- Command palette actions (manual push, force sync)
- Deadline/date sync from Obsidian to Things
- Checklist item sync
