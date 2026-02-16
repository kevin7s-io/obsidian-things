import { ThingsTask, ThingsStatus, TrackedTask, ScannedTask } from "./types";

export type ReconcileActionType =
    | "create-in-things"
    | "complete-in-things"
    | "reopen-in-things"
    | "complete-in-obsidian"
    | "reopen-in-obsidian"
    | "update-in-obsidian"
    | "unlink-from-obsidian";

export interface ReconcileAction {
    type: ReconcileActionType;
    uuid?: string;
    title?: string;
    filePath?: string;
    line?: number;
    thingsTask?: ThingsTask;
    scannedTask?: ScannedTask;
}

export function reconcile(
    scannedTasks: ScannedTask[],
    thingsTasks: ThingsTask[],
    trackedTasks: Record<string, TrackedTask>,
    conflictResolution: "things" | "obsidian"
): ReconcileAction[] {
    const actions: ReconcileAction[] = [];
    const thingsMap = new Map<string, ThingsTask>();
    for (const t of thingsTasks) {
        thingsMap.set(t.uuid, t);
    }

    for (const scanned of scannedTasks) {
        // Case 1: New in Obsidian — no UUID yet
        if (!scanned.uuid) {
            actions.push({
                type: "create-in-things",
                title: scanned.title,
                filePath: scanned.filePath,
                line: scanned.line,
                scannedTask: scanned,
            });
            continue;
        }

        const tracked = trackedTasks[scanned.uuid];
        const thingsTask = thingsMap.get(scanned.uuid);

        if (!tracked) {
            continue;
        }

        if (!thingsTask) {
            // Only unlink open (unchecked) tasks. Checked tasks missing from
            // readAllTasks are completed in Things' Logbook, not deleted.
            if (tracked && !scanned.checked) {
                actions.push({
                    type: "unlink-from-obsidian",
                    uuid: scanned.uuid,
                    filePath: scanned.filePath,
                    line: scanned.line,
                    scannedTask: scanned,
                });
            }
            continue;
        }

        const obsidianChanged = scanned.checked !== tracked.checked;
        const thingsCompleted = thingsTask.status === ThingsStatus.Completed;
        const thingsOpen = thingsTask.status === ThingsStatus.Open;
        const wasChecked = tracked.checked;

        if (obsidianChanged) {
            const thingsStatusChanged =
                (wasChecked && thingsOpen) || (!wasChecked && thingsCompleted);
            const thingsTitleChanged = thingsTask.title !== tracked.title;
            const thingsAlsoChanged = thingsStatusChanged || thingsTitleChanged;

            if (thingsAlsoChanged) {
                if (conflictResolution === "things") {
                    if (thingsCompleted && !scanned.checked) {
                        actions.push({
                            type: "complete-in-obsidian",
                            uuid: scanned.uuid,
                            filePath: scanned.filePath,
                            line: scanned.line,
                            thingsTask,
                        });
                    } else if (thingsOpen && scanned.checked) {
                        actions.push({
                            type: "reopen-in-obsidian",
                            uuid: scanned.uuid,
                            filePath: scanned.filePath,
                            line: scanned.line,
                            thingsTask,
                        });
                    }
                } else {
                    if (scanned.checked && !wasChecked) {
                        actions.push({
                            type: "complete-in-things",
                            uuid: scanned.uuid,
                            thingsTask,
                        });
                    } else if (!scanned.checked && wasChecked) {
                        actions.push({
                            type: "reopen-in-things",
                            uuid: scanned.uuid,
                            thingsTask,
                        });
                    }
                }
            } else {
                if (scanned.checked && !wasChecked) {
                    actions.push({
                        type: "complete-in-things",
                        uuid: scanned.uuid,
                        thingsTask,
                    });
                } else if (!scanned.checked && wasChecked) {
                    actions.push({
                        type: "reopen-in-things",
                        uuid: scanned.uuid,
                        thingsTask,
                    });
                }
            }
        } else {
            if (thingsCompleted && !scanned.checked) {
                actions.push({
                    type: "complete-in-obsidian",
                    uuid: scanned.uuid,
                    filePath: scanned.filePath,
                    line: scanned.line,
                    thingsTask,
                });
            } else if (thingsOpen && scanned.checked) {
                actions.push({
                    type: "reopen-in-obsidian",
                    uuid: scanned.uuid,
                    filePath: scanned.filePath,
                    line: scanned.line,
                    thingsTask,
                });
            }

            if (thingsTask.title !== tracked.title) {
                actions.push({
                    type: "update-in-obsidian",
                    uuid: scanned.uuid,
                    filePath: scanned.filePath,
                    line: scanned.line,
                    thingsTask,
                    scannedTask: scanned,
                });
            }
        }
    }

    return actions;
}

/**
 * Require a task to be missing from Things for two consecutive syncs before
 * actually unlinking it. This prevents premature unlinks caused by transient
 * JXA/timing issues where readAllTasks temporarily omits a task.
 */
export function filterPrematureUnlinks(
    actions: ReconcileAction[],
    previouslyMissing: Set<string>
): { filtered: ReconcileAction[]; currentlyMissing: Set<string> } {
    const currentlyMissing = new Set<string>();
    const filtered = actions.filter(a => {
        if (a.type === "unlink-from-obsidian" && a.uuid) {
            currentlyMissing.add(a.uuid);
            return previouslyMissing.has(a.uuid);
        }
        return true;
    });
    return { filtered, currentlyMissing };
}
