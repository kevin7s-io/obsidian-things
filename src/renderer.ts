import { ThingsTask, ThingsStatus } from "./types";
import { ParsedQuery } from "./query-parser";

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
    showProject: boolean,
    showDeadline: boolean
): void {
    const taskEl = container.createDiv({ cls: "things-task-item" });

    const checkbox = taskEl.createEl("input", {
        type: "checkbox",
        attr: task.status === ThingsStatus.Completed ? { checked: "" } : {},
    });
    checkbox.addEventListener("change", () => {
        handler.onToggle(task.uuid, checkbox.checked);
    });

    taskEl.createSpan({ text: task.title, cls: "things-task-title" });

    if (showProject && task.projectTitle) {
        taskEl.createSpan({
            text: ` (${task.projectTitle})`,
            cls: "things-task-meta",
        });
    }

    if (showDeadline && task.deadline) {
        taskEl.createSpan({
            text: ` 📅 ${task.deadline}`,
            cls: "things-task-deadline",
        });
    }
}

export function renderListView(
    el: HTMLElement,
    tasks: ThingsTask[],
    query: ParsedQuery,
    handler: TaskActionHandler,
    showProject: boolean,
    showDeadline: boolean
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
                renderTaskItem(container, task, handler, showProject, showDeadline);
            }
        }
    } else {
        for (const task of tasks) {
            renderTaskItem(container, task, handler, showProject, showDeadline);
        }
    }
}

export function renderKanbanView(
    el: HTMLElement,
    tasks: ThingsTask[],
    query: ParsedQuery,
    handler: TaskActionHandler,
    showProject: boolean,
    showDeadline: boolean
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
            renderTaskItem(cardContainer, task, handler, showProject, showDeadline);
        }
    }
}
