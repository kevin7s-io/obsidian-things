# Things Sync for Obsidian

Bidirectional sync between [Obsidian](https://obsidian.md) and [Things 3](https://culturedcode.com/things/) on macOS.

## What it does

- **Obsidian to Things:** Tag a checkbox with `#things` anywhere in the line and the plugin creates a matching task in Things 3. The UUID is written back as an invisible `%%things:UUID%%` comment so the two stay linked.
- **Things to Obsidian:** Changes made in Things (completing, reopening, renaming) are synced back to the tagged checkboxes in your vault.
- **Query views:** Embed live task lists from Things using a fenced code block DSL. Filter by project, area, tag, deadline, and more. Render as a list or kanban board. See [Query DSL](docs/query-dsl.md) for full reference.

## Requirements

- macOS desktop (reads the Things SQLite database directly)
- Things 3 installed
- Obsidian 1.0+

## Installation

1. Clone or download this repo into your vault's `.obsidian/plugins/obsidian-things/` directory.
2. Run `npm install && npm run build` to produce `main.js`.
3. Copy `main.js`, `manifest.json`, and `styles.css` into the plugin folder.
4. Enable **Things Sync** in Obsidian's Community Plugins settings.

## Quick start

### Syncing tasks

Add `#things` to any checkbox. The tag can go anywhere in the line:

```markdown
- [ ] #things Buy groceries
- [ ] Buy #things groceries
- [ ] Buy groceries #things
```

On the next sync cycle (default: every 30 seconds), the plugin creates the task in Things and appends a hidden UUID link. In reading view and live preview, the UUID is replaced with a small clickable link icon that opens the task in Things 3.

### Displaying Things tasks

Use a fenced `things` code block to query and display tasks from your Things database:

````markdown
```things
today
```
````

````markdown
```things
project: Work
status: open
sort: deadline
limit: 10
```
````

````markdown
```things
area: Personal
group: project
view: kanban
```
````

See [Query DSL](docs/query-dsl.md) for the full reference.

## Settings

| Setting | Default | Description |
|---|---|---|
| Things database path | Auto-detect | Leave blank to find it automatically |
| Sync interval | 30s | How often to sync (10–300s) |
| Sync on startup | On | Run a full sync when Obsidian launches |
| Sync tag | `#things` | Tag that marks checkboxes for sync |
| Show project | On | Append `(Project)` to synced lines |
| Show deadline | On | Append deadline date to synced lines |
| Show area | Off | Append `[Area]` to synced lines |
| Conflict resolution | Things wins | Which side wins when both changed |
| Auto-create in Things | On | Push new tagged checkboxes to Things |
| Default project | Inbox | Where new tasks land in Things |
| Debug logging | Off | Log sync details to the console |
| Dry run mode | Off | Preview sync actions without writing |

## Development

```bash
npm install
npm run build        # Type-check + bundle
npm run dev          # Watch mode
npm test             # Run tests (vitest)
```

## License

MIT
