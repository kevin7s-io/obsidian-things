# Things Query DSL

The Things Sync plugin lets you embed live task views from your Things 3 database using fenced code blocks. This page documents every filter, sort, grouping, and view option available.

## Basic usage

Create a fenced code block with the `things` language identifier:

````markdown
```things
today
```
````

The block is replaced with a rendered task list that updates each time the plugin syncs.

## List filters

A single keyword on its own line filters tasks by their Things list. Only one list filter can be active at a time.

| Keyword | Matches |
|---|---|
| `today` | Tasks whose start date is today |
| `inbox` | Tasks in the Inbox |
| `upcoming` | Open tasks with a start date set |
| `someday` | Tasks marked as Someday |
| `logbook` | Completed tasks |

### Examples

````markdown
```things
today
```
````

````markdown
```things
logbook
```
````

## Property filters

Property filters use `key: value` syntax, one per line. They can be combined with each other and with a list filter.

| Key | Value | Description |
|---|---|---|
| `project` | Project name (exact match) | Only tasks in this Things project |
| `area` | Area name (exact match) | Only tasks in this Things area |
| `tag` | Tag name | Only tasks with this Things tag |
| `status` | `open`, `completed`, or `canceled` | Filter by task status |
| `deadline` | Date string | Filter by deadline |

### Examples

````markdown
```things
project: Work
status: open
```
````

````markdown
```things
area: Personal
tag: urgent
```
````

````markdown
```things
today
project: Errands
```
````

## Sorting

Use `sort: <field>` to order results. Without a sort directive, tasks appear in database order.

| Value | Description |
|---|---|
| `deadline` | Earliest deadline first (tasks without a deadline sort last) |
| `title` | Alphabetical by title |
| `project` | Alphabetical by project name |
| `area` | Alphabetical by area name |

### Example

````markdown
```things
project: Work
sort: deadline
```
````

## Limiting results

Use `limit: <number>` to cap the number of tasks shown.

````markdown
```things
today
sort: deadline
limit: 5
```
````

## Grouping

Use `group: <field>` to visually group tasks under headers. In list view, each group gets a heading. In kanban view, each group becomes a column.

| Value | Description |
|---|---|
| `project` | Group by Things project |
| `area` | Group by Things area |
| `tag` | Group by Things tag (tasks with multiple tags appear in each group) |

### Example

````markdown
```things
status: open
group: project
```
````

## View modes

Use `view: <mode>` to choose how tasks are rendered. Default is `list`.

| Value | Description |
|---|---|
| `list` | Vertical list with checkboxes. Groups render as section headers. |
| `kanban` | Horizontal columns. Each group becomes a column. Defaults to grouping by project if no `group` is specified. |

### Example

````markdown
```things
area: Work
group: project
view: kanban
```
````

## Interacting with tasks

Each rendered task has a checkbox. Toggling it sends a complete or reopen command to Things 3 via AppleScript, so the change is reflected in both apps immediately.

## Full example

A kanban board of open work tasks, sorted by deadline, capped at 20:

````markdown
```things
area: Work
status: open
group: project
sort: deadline
limit: 20
view: kanban
```
````

## All options at a glance

```
<list-filter>          today | inbox | upcoming | someday | logbook
project: <name>        Filter by project
area: <name>           Filter by area
tag: <name>            Filter by tag
status: <status>       open | completed | canceled
deadline: <date>       Filter by deadline
sort: <field>          deadline | title | project | area
limit: <number>        Max tasks to show
group: <field>         project | area | tag
view: <mode>           list | kanban
```
