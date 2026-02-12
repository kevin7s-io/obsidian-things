import { describe, it, expect } from "vitest";
import { parseQuery, filterTasks } from "./query-parser";
import { ThingsTask, ThingsStatus, ThingsItemType, ThingsStart } from "./types";

describe("parseQuery", () => {
    it("parses a simple 'today' query", () => {
        const q = parseQuery("today");
        expect(q.list).toBe("today");
    });

    it("parses multiple filters", () => {
        const q = parseQuery("project: Work\nstatus: open\nsort: deadline\nlimit: 10");
        expect(q.project).toBe("Work");
        expect(q.status).toBe("open");
        expect(q.sort).toBe("deadline");
        expect(q.limit).toBe(10);
    });

    it("parses view and group", () => {
        const q = parseQuery("group: project\nview: kanban");
        expect(q.group).toBe("project");
        expect(q.view).toBe("kanban");
    });

    it("parses tag filter", () => {
        const q = parseQuery("tag: urgent");
        expect(q.tag).toBe("urgent");
    });

    it("defaults view to list", () => {
        const q = parseQuery("today");
        expect(q.view).toBe("list");
    });
});

const makeTask = (overrides: Partial<ThingsTask> = {}): ThingsTask => ({
    uuid: "test-uuid",
    title: "Test task",
    status: ThingsStatus.Open,
    type: ThingsItemType.Todo,
    notes: "",
    project: null,
    projectTitle: null,
    area: null,
    areaTitle: null,
    tags: [],
    startDate: null,
    deadline: null,
    stopDate: null,
    creationDate: 0,
    userModificationDate: 0,
    start: ThingsStart.Anytime,
    inTodayList: false,
    trashed: false,
    ...overrides,
});

describe("filterTasks", () => {
    it("filters by status open", () => {
        const tasks = [
            makeTask({ status: ThingsStatus.Open }),
            makeTask({ status: ThingsStatus.Completed }),
        ];
        const q = parseQuery("status: open");
        const result = filterTasks(tasks, q);
        expect(result).toHaveLength(1);
        expect(result[0]!.status).toBe(ThingsStatus.Open);
    });

    it("filters by project", () => {
        const tasks = [
            makeTask({ projectTitle: "Work" }),
            makeTask({ projectTitle: "Personal" }),
        ];
        const q = parseQuery("project: Work");
        const result = filterTasks(tasks, q);
        expect(result).toHaveLength(1);
        expect(result[0]!.projectTitle).toBe("Work");
    });

    it("filters by tag", () => {
        const tasks = [
            makeTask({ tags: ["urgent", "work"] }),
            makeTask({ tags: ["personal"] }),
        ];
        const q = parseQuery("tag: urgent");
        const result = filterTasks(tasks, q);
        expect(result).toHaveLength(1);
    });

    it("applies limit", () => {
        const tasks = [makeTask(), makeTask(), makeTask()];
        const q = parseQuery("limit: 2");
        const result = filterTasks(tasks, q);
        expect(result).toHaveLength(2);
    });

    it("sorts by deadline", () => {
        const tasks = [
            makeTask({ deadline: "2026-03-01", title: "Later" }),
            makeTask({ deadline: "2026-01-01", title: "Sooner" }),
        ];
        const q = parseQuery("sort: deadline");
        const result = filterTasks(tasks, q);
        expect(result[0]!.title).toBe("Sooner");
    });

    it("filters today tasks by Today list membership", () => {
        const tasks = [
            makeTask({ inTodayList: true, title: "Today task" }),
            makeTask({ inTodayList: false, start: ThingsStart.Anytime, title: "Anytime task" }),
            makeTask({ inTodayList: false, startDate: "2099-01-01", title: "Future task" }),
        ];
        const q = parseQuery("today");
        const result = filterTasks(tasks, q);
        expect(result).toHaveLength(1);
        expect(result[0]!.title).toBe("Today task");
    });

    it("filters inbox tasks", () => {
        const tasks = [
            makeTask({ start: ThingsStart.Inbox }),
            makeTask({ start: ThingsStart.Anytime }),
        ];
        const q = parseQuery("inbox");
        const result = filterTasks(tasks, q);
        expect(result).toHaveLength(1);
        expect(result[0]!.start).toBe(ThingsStart.Inbox);
    });
});
