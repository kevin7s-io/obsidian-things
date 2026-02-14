# Things Sync for Obsidian

Keep your Obsidian notes and Things 3 tasks in sync — automatically, bidirectionally, without leaving your vault.

## Why

If you use both Obsidian and Things 3, you've probably wished they could talk to each other. Maybe you jot down tasks in a meeting note but still manage your day in Things, or you complete a task in Things and want your note to reflect that. Things Sync bridges the gap so you can capture tasks wherever it's convenient and trust that both apps stay up to date.

## Features

- **Two-way sync** — Create a task in Obsidian and it appears in Things. Complete it in Things and it checks off in Obsidian.
- **Simple tagging** — Just add `#things` to any checkbox to sync it. That's it.
- **Live query blocks** — Embed dynamic task lists from Things right in your notes. Filter by project, area, tag, status, and more.
- **Kanban view** — Display query results as a kanban board grouped by project, area, or tag.
- **Rich task cards** — Synced tasks show project, tags, dates, and notes at a glance. Switch between card and inline badge styles.
- **Edit from Obsidian** — Click the edit button on any task card to update its title, notes, tags, or dates without switching apps.

## Requirements

- macOS (desktop only)
- [Things 3](https://culturedcode.com/things/) installed
- [Obsidian](https://obsidian.md) 1.0 or later

## Installation

### With BRAT (recommended)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) community plugin if you don't have it.
2. Open **Settings → BRAT → Add Beta Plugin**.
3. Enter `kevin7s-io/obsidian-things` and click **Add Plugin**.
4. Enable **Things Sync** in **Settings → Community Plugins**.

BRAT will keep the plugin updated automatically.

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/kevin7s-io/obsidian-things/releases/latest).
2. Create `.obsidian/plugins/obsidian-things/` in your vault if it doesn't exist.
3. Copy the three files into that folder.
4. Enable **Things Sync** in **Settings → Community Plugins**.

## Setup & permissions

On first launch the plugin will try to open Things 3 in the background. You may see a macOS prompt asking Obsidian to control Things — allow this so the plugin can read and create tasks.

To edit task dates from Obsidian, you'll also need a **Things auth token**:

1. Open Things 3 → **Settings → General → Enable Things URLs**.
2. Copy the auth token shown there.
3. In Obsidian, go to **Settings → Things Sync** and paste it into the **Things auth token** field.

Everything else works without the token. The plugin only communicates locally between Obsidian and Things on your Mac — nothing is sent to the internet.

## Usage

### Creating tasks

Add `#things` to any checkbox in your notes:

```markdown
- [ ] Buy groceries #things
- [ ] Call the dentist #things
```

On the next sync cycle the plugin creates matching tasks in Things and links them with a hidden identifier. In live preview the identifier is invisible — you'll just see a clickable Things logo that opens the task in Things 3.

### How sync works

The plugin checks for changes every 30 seconds (configurable). When it finds updates on either side it reconciles them:

- **Task completed in Things** → checkbox gets checked in Obsidian
- **Task reopened in Things** → checkbox gets unchecked
- **Title changed in Things** → Obsidian text updates to match
- **New `#things` checkbox in Obsidian** → task created in Things

If both sides changed, the conflict resolution setting decides which wins (Things by default).

### Query blocks

Embed a live view of your Things tasks using a fenced `things` code block:

````markdown
```things
today
```
````

This renders an updating list of your Today tasks right in the note.

#### List filters

Use a single keyword to pull from a built-in Things list:

| Keyword | Shows |
|---|---|
| `today` | Today list |
| `inbox` | Inbox |
| `upcoming` | Tasks with a future start date |
| `someday` | Someday list |
| `logbook` | Completed tasks |

#### Property filters

Narrow results with `key: value` lines:

```
project: Work
area: Personal
tag: urgent
status: open
deadline: 2026-03-01
```

`status` accepts `open`, `completed`, or `canceled`.

#### Sorting, grouping, and limits

```
sort: deadline
group: project
limit: 10
view: kanban
```

`sort` accepts `deadline`, `title`, `project`, or `area`. `group` accepts `project`, `area`, or `tag`. `view` accepts `list` (default) or `kanban`.

#### Examples

Today's tasks:

````markdown
```things
today
```
````

Open work tasks sorted by deadline:

````markdown
```things
project: Work
status: open
sort: deadline
limit: 10
```
````

Personal tasks as a kanban board:

````markdown
```things
area: Personal
group: project
view: kanban
```
````

### Editing tasks

Click the pencil icon on any task card to edit its title, notes, tags, scheduled date, or deadline. Changes push to Things immediately.

## Settings

| Setting | Default | What it does |
|---|---|---|
| Sync interval | 30 s | How often the plugin checks for changes |
| Sync on startup | On | Run a sync when Obsidian launches |
| Launch Things on startup | On | Start Things in the background if it isn't running |
| Sync tag | `#things` | The tag that marks checkboxes for sync |
| Display mode | Inline | Show synced tasks as `inline` badges or `card` style |
| Show project | On | Display the project name on tasks |
| Show deadline | On | Display the deadline on tasks |
| Show area | Off | Display the area name on tasks |
| Show start date | Off | Display the scheduled date on tasks |
| Show tags | On | Display tag badges on tasks |
| Conflict resolution | Things wins | Which side wins when both changed |
| Auto-create in Things | On | Automatically push new tagged checkboxes to Things |
| Default project | Inbox | Where new tasks land in Things |
| Things auth token | — | Required for editing dates (see Setup above) |
| Debug logging | Off | Log sync details to the developer console |
| Dry run mode | Off | Preview what the plugin would do without making changes |

## License

[MIT](LICENSE)
