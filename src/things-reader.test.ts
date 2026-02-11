import { describe, it, expect } from "vitest";
import { ThingsNotRunningError, rawToTask } from "./things-reader";
import { ThingsStatus, ThingsItemType, ThingsStart } from "./types";

describe("ThingsNotRunningError", () => {
    it("is an instance of Error", () => {
        const err = new ThingsNotRunningError();
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe("ThingsNotRunningError");
        expect(err.message).toBe("Things 3 is not running");
    });
});

describe("rawToTask", () => {
    it("maps JXA output to ThingsTask", () => {
        const raw = {
            uuid: "ABC-123",
            title: "Buy groceries",
            status: 0,
            notes: "milk, eggs",
            project: "PROJ-1",
            projectTitle: "Shopping",
            area: "AREA-1",
            areaTitle: "Personal",
            tags: ["urgent", "errand"],
            startDate: "2026-02-15",
            deadline: "2026-02-20",
            stopDate: null,
            creationDate: 1739000000,
            modificationDate: 1739100000,
            start: 1,
        };

        const task = rawToTask(raw);
        expect(task.uuid).toBe("ABC-123");
        expect(task.title).toBe("Buy groceries");
        expect(task.status).toBe(ThingsStatus.Open);
        expect(task.type).toBe(ThingsItemType.Todo);
        expect(task.notes).toBe("milk, eggs");
        expect(task.project).toBe("PROJ-1");
        expect(task.projectTitle).toBe("Shopping");
        expect(task.area).toBe("AREA-1");
        expect(task.areaTitle).toBe("Personal");
        expect(task.tags).toEqual(["urgent", "errand"]);
        expect(task.startDate).toBe("2026-02-15");
        expect(task.deadline).toBe("2026-02-20");
        expect(task.stopDate).toBeNull();
        expect(task.creationDate).toBe(1739000000);
        expect(task.userModificationDate).toBe(1739100000);
        expect(task.start).toBe(ThingsStart.Anytime);
        expect(task.trashed).toBe(false);
    });

    it("maps completed status correctly", () => {
        const raw = {
            uuid: "DEF-456",
            title: "Done task",
            status: 3,
            notes: "",
            project: null,
            projectTitle: null,
            area: null,
            areaTitle: null,
            tags: [],
            startDate: null,
            deadline: null,
            stopDate: 1739200000,
            creationDate: 1739000000,
            modificationDate: 1739200000,
            start: 1,
        };

        const task = rawToTask(raw);
        expect(task.status).toBe(ThingsStatus.Completed);
        expect(task.stopDate).toBe(1739200000);
    });

    it("maps canceled status correctly", () => {
        const raw = {
            uuid: "GHI-789",
            title: "Canceled task",
            status: 2,
            notes: "",
            project: null,
            projectTitle: null,
            area: null,
            areaTitle: null,
            tags: [],
            startDate: null,
            deadline: null,
            stopDate: null,
            creationDate: 1739000000,
            modificationDate: 1739000000,
            start: 1,
        };

        const task = rawToTask(raw);
        expect(task.status).toBe(ThingsStatus.Canceled);
    });
});
