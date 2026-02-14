import { describe, it, expect } from "vitest";
import { reconcile, ReconcileAction } from "./sync-engine";
import { ThingsTask, ThingsStatus, ThingsItemType, ThingsStart, TrackedTask, ScannedTask } from "./types";

const makeThingsTask = (overrides: Partial<ThingsTask> = {}): ThingsTask => ({
    uuid: "UUID-1",
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
    userModificationDate: 100,
    start: ThingsStart.Anytime,
    inTodayList: false,
    trashed: false,
    ...overrides,
});

const makeScanned = (overrides: Partial<ScannedTask> = {}): ScannedTask => ({
    filePath: "test.md",
    line: 0,
    checked: false,
    title: "Test task",
    uuid: "UUID-1",
    rawLine: "- [ ] Test task #things <!-- things:UUID-1 -->",
    indent: "",
    ...overrides,
});

const makeTracked = (overrides: Partial<TrackedTask> = {}): TrackedTask => ({
    uuid: "UUID-1",
    filePath: "test.md",
    line: 0,
    checked: false,
    title: "Test task",
    lastSyncTimestamp: 50,
    ...overrides,
});

describe("reconcile", () => {
    it("detects new task in Obsidian (no UUID)", () => {
        const scanned = [makeScanned({ uuid: null, title: "New task" })];
        const actions = reconcile(scanned, [], {}, "things");
        expect(actions).toHaveLength(1);
        expect(actions[0]!.type).toBe("create-in-things");
        expect(actions[0]!.title).toBe("New task");
    });

    it("detects task completed in Obsidian", () => {
        const scanned = [makeScanned({ checked: true })];
        const tracked: Record<string, TrackedTask> = {
            "UUID-1": makeTracked({ checked: false }),
        };
        const things = [makeThingsTask({ status: ThingsStatus.Open })];
        const actions = reconcile(scanned, things, tracked, "things");
        expect(actions).toHaveLength(1);
        expect(actions[0]!.type).toBe("complete-in-things");
    });

    it("detects task reopened in Obsidian", () => {
        const scanned = [makeScanned({ checked: false })];
        const tracked: Record<string, TrackedTask> = {
            "UUID-1": makeTracked({ checked: true }),
        };
        const things = [makeThingsTask({ status: ThingsStatus.Completed })];
        const actions = reconcile(scanned, things, tracked, "things");
        expect(actions).toHaveLength(1);
        expect(actions[0]!.type).toBe("reopen-in-things");
    });

    it("detects task completed in Things", () => {
        const scanned = [makeScanned({ checked: false })];
        const tracked: Record<string, TrackedTask> = {
            "UUID-1": makeTracked({ checked: false }),
        };
        const things = [makeThingsTask({ status: ThingsStatus.Completed })];
        const actions = reconcile(scanned, things, tracked, "things");
        expect(actions).toHaveLength(1);
        expect(actions[0]!.type).toBe("complete-in-obsidian");
    });

    it("detects task reopened in Things", () => {
        const scanned = [makeScanned({ checked: true })];
        const tracked: Record<string, TrackedTask> = {
            "UUID-1": makeTracked({ checked: true }),
        };
        const things = [makeThingsTask({ status: ThingsStatus.Open })];
        const actions = reconcile(scanned, things, tracked, "things");
        expect(actions).toHaveLength(1);
        expect(actions[0]!.type).toBe("reopen-in-obsidian");
    });

    it("things wins on conflict by default", () => {
        const scanned = [makeScanned({ checked: true })];
        const tracked: Record<string, TrackedTask> = {
            "UUID-1": makeTracked({ checked: false }),
        };
        const things = [makeThingsTask({ status: ThingsStatus.Open, title: "Updated title" })];
        const actions = reconcile(scanned, things, tracked, "things");
        const hasReopen = actions.some((a) => a.type === "reopen-in-obsidian");
        const hasComplete = actions.some((a) => a.type === "complete-in-things");
        expect(hasReopen).toBe(true);
        expect(hasComplete).toBe(false);
    });

    it("emits unlink action when tracked task deleted from Things", () => {
        const scanned = [makeScanned()];
        const tracked: Record<string, TrackedTask> = {
            "UUID-1": makeTracked(),
        };
        const actions = reconcile(scanned, [], tracked, "things");
        expect(actions).toHaveLength(1);
        expect(actions[0]!.type).toBe("unlink-from-obsidian");
        expect(actions[0]!.uuid).toBe("UUID-1");
    });

    it("skips untracked task missing from Things", () => {
        const scanned = [makeScanned()];
        const actions = reconcile(scanned, [], {}, "things");
        expect(actions).toHaveLength(0);
    });

    it("obsidian wins on conflict when configured", () => {
        const scanned = [makeScanned({ checked: true })];
        const tracked: Record<string, TrackedTask> = {
            "UUID-1": makeTracked({ checked: false }),
        };
        const things = [makeThingsTask({ status: ThingsStatus.Open, title: "Updated title" })];
        const actions = reconcile(scanned, things, tracked, "obsidian");
        const hasComplete = actions.some((a) => a.type === "complete-in-things");
        const hasReopen = actions.some((a) => a.type === "reopen-in-obsidian");
        expect(hasComplete).toBe(true);
        expect(hasReopen).toBe(false);
    });
});
