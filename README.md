# Things Sync for Obsidian

Bidirectional sync between [Obsidian](https://obsidian.md) and [Things 3](https://culturedcode.com/things/) on macOS.

## What it does

- **Obsidian to Things:** Tag a checkbox with `#things` and the plugin creates a matching task in Things 3. A hidden HTML comment (`<!-- things:UUID -->`) links the two.
- **Things to Obsidian:** Completing, reopening, or renaming tasks in Things syncs back to tagged checkboxes in your vault.
- **Query views:** Embed live task lists from Things using fenced `things` code blocks. Filter by project, area, tag, status, and more. Renders as a list or kanban board.
- **Card & inline display:** Synced tasks render as rich cards (with notes, tags, dates, project) or inline badges. Editable directly from Obsidian via the edit button.

## Requirements

- macOS desktop
- Things 3 installed and running
- Obsidian 1.0+

## Installation

1. Clone or download this repo into your vault's `.obsidian/plugins/obsidian-things/` directory.
2. Run `npm install && npm run build`.
3. Copy `main.js`, `manifest.json`, and `styles.css` into the plugin folder.
4. Enable **Things Sync** in Obsidian's Community Plugins settings.

## Syncing tasks

Add `#things` to any checkbox:

```markdown
- [ ] Buy groceries #things
- [ ] #things Call dentist
```

On the next sync cycle the plugin creates the task in Things and appends a hidden UUID:

```markdown
- [ ] Buy groceries #things <!-- things:ABC123 -->
```

In live preview and reading view the UUID is hidden. A clickable Things logo opens the task in Things 3. Metadata badges show tags, scheduled date, deadline, project, and area.

## Query DSL

Use a fenced `things` code block to query and display tasks:

````markdown
```things
today
```
````

### List filters

Single keywords that match Things' built-in lists:

| Filter | Description |
|---|---|
| `today` | Tasks in the Today list |
| `inbox` | Tasks in the Inbox |
| `upcoming` | Open tasks with a scheduled date |
| `someday` | Tasks in the Someday list |
| `logbook` | Completed tasks |

### Property filters

`key: value` pairs that narrow results:

| Key | Example | Description |
|---|---|---|
| `project` | `project: Work` | Exact match on project name |
| `area` | `area: Personal` | Exact match on area name |
| `tag` | `tag: urgent` | Tasks containing this tag |
| `status` | `status: open` | `open`, `completed`, or `canceled` |
| `deadline` | `deadline: 2026-03-01` | Filter by deadline date |

### Sorting, grouping, limits

| Key | Values | Description |
|---|---|---|
| `sort` | `deadline`, `title`, `project`, `area` | Sort order |
| `group` | `project`, `area`, `tag` | Group tasks under headers |
| `limit` | any number | Max tasks to show |
| `view` | `list`, `kanban` | Display mode |

### Examples

Show today's tasks:

````markdown
```things
today
```
````

Open tasks in a project, sorted by deadline:

````markdown
```things
project: Work
status: open
sort: deadline
limit: 10
```
````

Kanban board grouped by project:

````markdown
```things
area: Personal
group: project
view: kanban
```
````

## Editing tasks

Click the pencil icon on any card to edit:

- Title
- Notes
- Tags
- Scheduled date
- Deadline

Changes push to Things immediately. Dates require a Things auth token (set in plugin settings).

## Settings

| Setting | Default | Description |
|---|---|---|
| Sync interval | 30s | How often to sync (seconds) |
| Sync on startup | On | Run sync when Obsidian launches |
| Launch Things on startup | On | Start Things in background |
| Sync tag | `#things` | Tag that marks checkboxes for sync |
| Display mode | Inline | `inline` (badges) or `card` (Things-style cards) |
| Show project | On | Display project name |
| Show deadline | On | Display deadline |
| Show area | Off | Display area name |
| Show start date | Off | Display scheduled date |
| Show tags | On | Display tag badges |
| Conflict resolution | Things wins | Which side wins on conflict |
| Auto-create in Things | On | Push new tagged checkboxes to Things |
| Default project | Inbox | Where new tasks land |
| Things auth token | (empty) | Required for editing dates via URL scheme |
| Debug logging | Off | Log sync details to console |
| Dry run mode | Off | Preview actions without writing |

## Development

```bash
npm install
npm run build        # Type-check + bundle
npm run dev          # Watch mode
npm test             # Run tests (vitest)
```

## License

MIT
