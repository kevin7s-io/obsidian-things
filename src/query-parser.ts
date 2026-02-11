import { ThingsTask, ThingsStatus, ThingsStart } from "./types";

export interface ParsedQuery {
    list?: string;
    project?: string;
    area?: string;
    tag?: string;
    status?: string;
    deadline?: string;
    sort?: string;
    limit?: number;
    group?: string;
    view: "list" | "kanban" | "table";
}

export function parseQuery(source: string): ParsedQuery {
    const query: ParsedQuery = { view: "list" };
    const lines = source.trim().split("\n").map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) {
            // Single-word filter like "today", "inbox", "upcoming", "someday", "logbook"
            query.list = line.toLowerCase();
            continue;
        }

        const key = line.slice(0, colonIdx).trim().toLowerCase();
        const value = line.slice(colonIdx + 1).trim();

        switch (key) {
            case "project": query.project = value; break;
            case "area": query.area = value; break;
            case "tag": query.tag = value; break;
            case "status": query.status = value.toLowerCase(); break;
            case "deadline": query.deadline = value; break;
            case "sort": query.sort = value.toLowerCase(); break;
            case "limit": query.limit = parseInt(value, 10) || undefined; break;
            case "group": query.group = value.toLowerCase(); break;
            case "view":
                if (value === "kanban" || value === "table" || value === "list") {
                    query.view = value;
                }
                break;
        }
    }

    return query;
}

function getToday(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export function filterTasks(tasks: ThingsTask[], query: ParsedQuery): ThingsTask[] {
    let result = [...tasks];

    // List-based filters
    if (query.list) {
        switch (query.list) {
            case "today":
                const today = getToday();
                result = result.filter(
                    (t) => t.startDate === today || t.start === ThingsStart.Anytime
                );
                break;
            case "inbox":
                result = result.filter((t) => t.start === ThingsStart.Inbox);
                break;
            case "upcoming":
                result = result.filter((t) => t.startDate !== null && t.status === ThingsStatus.Open);
                break;
            case "someday":
                result = result.filter((t) => t.start === ThingsStart.Someday);
                break;
            case "logbook":
                result = result.filter((t) => t.status === ThingsStatus.Completed);
                break;
        }
    }

    // Property filters
    if (query.project) {
        result = result.filter((t) => t.projectTitle === query.project);
    }
    if (query.area) {
        result = result.filter((t) => t.areaTitle === query.area);
    }
    if (query.tag) {
        result = result.filter((t) => t.tags.includes(query.tag!));
    }
    if (query.status) {
        const statusMap: Record<string, ThingsStatus> = {
            open: ThingsStatus.Open,
            completed: ThingsStatus.Completed,
            canceled: ThingsStatus.Canceled,
        };
        const s = statusMap[query.status];
        if (s !== undefined) {
            result = result.filter((t) => t.status === s);
        }
    }

    // Sort
    if (query.sort) {
        result.sort((a, b) => {
            switch (query.sort) {
                case "deadline":
                    return (a.deadline || "9999") .localeCompare(b.deadline || "9999");
                case "title":
                    return a.title.localeCompare(b.title);
                case "project":
                    return (a.projectTitle || "").localeCompare(b.projectTitle || "");
                case "area":
                    return (a.areaTitle || "").localeCompare(b.areaTitle || "");
                default:
                    return 0;
            }
        });
    }

    // Limit
    if (query.limit) {
        result = result.slice(0, query.limit);
    }

    return result;
}
