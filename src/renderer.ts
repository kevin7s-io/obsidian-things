import { ThingsTask, ThingsStatus, ThingsSyncSettings } from "./types";
import { ParsedQuery } from "./query-parser";
import { createThingsLogoLink, createMetadataBadges, BadgeSettings } from "./things-link-widget";

/** Strip any leaked <!-- things:UUID --> or sync tags from display titles */
function cleanTitle(title: string): string {
    return title
        .replace(/<!--\s*things:.+?\s*-->/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}

export interface TaskActionHandler {
    onToggle(uuid: string, completed: boolean): void;
}

function groupTasks(
    tasks: ThingsTask[],
    groupBy: string
): Record<string, ThingsTask[]> {
    const groups: Record<string, ThingsTask[]> = {};
    for (const task of tasks) {
        let key: string;
        switch (groupBy) {
            case "project":
                key = task.projectTitle || "(No Project)";
                break;
            case "area":
                key = task.areaTitle || "(No Area)";
                break;
            case "tag":
                if (task.tags.length === 0) {
                    key = "(No Tags)";
                    groups[key] = groups[key] || [];
                    groups[key]!.push(task);
                    continue;
                }
                for (const tag of task.tags) {
                    groups[tag] = groups[tag] || [];
                    groups[tag]!.push(task);
                }
                continue;
            default:
                key = "(All)";
        }
        groups[key] = groups[key] || [];
        groups[key]!.push(task);
    }
    return groups;
}

function renderTaskItem(
    container: HTMLElement,
    task: ThingsTask,
    handler: TaskActionHandler,
    settings: BadgeSettings
): void {
    const taskEl = container.createDiv({ cls: "things-task-item" });

    const checkbox = taskEl.createEl("input", {
        type: "checkbox",
        attr: task.status === ThingsStatus.Completed ? { checked: "" } : {},
    });
    checkbox.addEventListener("change", () => {
        handler.onToggle(task.uuid, checkbox.checked);
    });

    taskEl.appendChild(createThingsLogoLink(task.uuid));

    taskEl.createSpan({ text: cleanTitle(task.title), cls: "things-task-title" });

    taskEl.appendChild(createMetadataBadges(task, settings, true));
}

export function renderListView(
    el: HTMLElement,
    tasks: ThingsTask[],
    query: ParsedQuery,
    handler: TaskActionHandler,
    settings: ThingsSyncSettings
): void {
    const container = el.createDiv({ cls: "things-list-view" });

    if (tasks.length === 0) {
        container.createEl("p", { text: "No tasks found.", cls: "things-empty" });
        return;
    }

    if (query.group) {
        const groups = groupTasks(tasks, query.group);
        for (const [groupName, groupTasks] of Object.entries(groups)) {
            container.createEl("h4", { text: groupName, cls: "things-group-header" });
            for (const task of groupTasks) {
                renderTaskItem(container, task, handler, settings);
            }
        }
    } else {
        for (const task of tasks) {
            renderTaskItem(container, task, handler, settings);
        }
    }
}

export function renderKanbanView(
    el: HTMLElement,
    tasks: ThingsTask[],
    query: ParsedQuery,
    handler: TaskActionHandler,
    settings: ThingsSyncSettings
): void {
    const container = el.createDiv({ cls: "things-kanban-view" });

    if (tasks.length === 0) {
        container.createEl("p", { text: "No tasks found.", cls: "things-empty" });
        return;
    }

    const groupField = query.group || "project";
    const groups = groupTasks(tasks, groupField);

    for (const [groupName, groupTasks] of Object.entries(groups)) {
        const column = container.createDiv({ cls: "things-kanban-column" });
        column.createEl("h4", { text: groupName, cls: "things-kanban-header" });
        const cardContainer = column.createDiv({ cls: "things-kanban-cards" });
        for (const task of groupTasks) {
            renderTaskItem(cardContainer, task, handler, settings);
        }
    }
}
