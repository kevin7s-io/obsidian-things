import { describe, it, expect } from "vitest";
import { reconcile, ReconcileAction, filterPrematureUnlinks } from "./sync-engine";
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

    it("does not unlink task missing for only one sync", () => {
        const scanned = [makeScanned()];
        const tracked: Record<string, TrackedTask> = {
            "UUID-1": makeTracked(),
        };
        const actions = reconcile(scanned, [], tracked, "things");
        const { filtered } = filterPrematureUnlinks(actions, new Set());
        expect(filtered).toHaveLength(0);
    });

    it("unlinks task missing for two consecutive syncs", () => {
        const scanned = [makeScanned()];
        const tracked: Record<string, TrackedTask> = {
            "UUID-1": makeTracked(),
        };
        const actions = reconcile(scanned, [], tracked, "things");
        const { filtered } = filterPrematureUnlinks(actions, new Set(["UUID-1"]));
        expect(filtered).toHaveLength(1);
        expect(filtered[0]!.type).toBe("unlink-from-obsidian");
    });

    it("cancels unlink when task reappears after one miss", () => {
        const scanned = [makeScanned()];
        const tracked: Record<string, TrackedTask> = {
            "UUID-1": makeTracked(),
        };

        // Sync 1: task missing — deferred
        const actions1 = reconcile(scanned, [], tracked, "things");
        const { currentlyMissing } = filterPrematureUnlinks(actions1, new Set());

        // Sync 2: task reappears
        const things = [makeThingsTask()];
        const actions2 = reconcile(scanned, things, tracked, "things");
        const { filtered, currentlyMissing: missing2 } = filterPrematureUnlinks(actions2, currentlyMissing);

        expect(filtered).toHaveLength(0);
        expect(missing2.size).toBe(0);
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

describe("filterPrematureUnlinks", () => {
    it("passes non-unlink actions through unchanged", () => {
        const actions: ReconcileAction[] = [
            { type: "complete-in-things", uuid: "UUID-1" },
            { type: "create-in-things", title: "New task" },
        ];
        const { filtered } = filterPrematureUnlinks(actions, new Set());
        expect(filtered).toEqual(actions);
    });

    it("blocks unlink on first miss (empty previouslyMissing)", () => {
        const actions: ReconcileAction[] = [
            { type: "unlink-from-obsidian", uuid: "UUID-1", filePath: "test.md", line: 0 },
        ];
        const { filtered, currentlyMissing } = filterPrematureUnlinks(actions, new Set());
        expect(filtered).toHaveLength(0);
        expect(currentlyMissing.has("UUID-1")).toBe(true);
    });

    it("passes unlink when UUID was previously missing", () => {
        const actions: ReconcileAction[] = [
            { type: "unlink-from-obsidian", uuid: "UUID-1", filePath: "test.md", line: 0 },
        ];
        const { filtered } = filterPrematureUnlinks(actions, new Set(["UUID-1"]));
        expect(filtered).toHaveLength(1);
        expect(filtered[0]!.type).toBe("unlink-from-obsidian");
    });

    it("tracks all currently missing UUIDs", () => {
        const actions: ReconcileAction[] = [
            { type: "unlink-from-obsidian", uuid: "UUID-1", filePath: "a.md", line: 0 },
            { type: "unlink-from-obsidian", uuid: "UUID-2", filePath: "b.md", line: 0 },
            { type: "complete-in-things", uuid: "UUID-3" },
        ];
        const { currentlyMissing } = filterPrematureUnlinks(actions, new Set());
        expect(currentlyMissing).toEqual(new Set(["UUID-1", "UUID-2"]));
    });

    it("mixes deferred and confirmed unlinks correctly", () => {
        const actions: ReconcileAction[] = [
            { type: "unlink-from-obsidian", uuid: "UUID-1", filePath: "a.md", line: 0 },
            { type: "unlink-from-obsidian", uuid: "UUID-2", filePath: "b.md", line: 0 },
        ];
        // Only UUID-1 was previously missing
        const { filtered } = filterPrematureUnlinks(actions, new Set(["UUID-1"]));
        expect(filtered).toHaveLength(1);
        expect(filtered[0]!.uuid).toBe("UUID-1");
    });
});
