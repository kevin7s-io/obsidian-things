import { StateField, StateEffect } from "@codemirror/state";
import type { ThingsTask, ThingsSyncSettings } from "./types";

export interface TaskCacheState {
    tasks: Map<string, ThingsTask>;
    showProject: boolean;
    showDeadline: boolean;
    showArea: boolean;
    showStartDate: boolean;
    showTags: boolean;
    displayMode: "inline" | "card";
    syncTag: string;
}

const EMPTY_CACHE: TaskCacheState = {
    tasks: new Map(),
    showProject: true,
    showDeadline: true,
    showArea: false,
    showStartDate: false,
    showTags: true,
    displayMode: "inline",
    syncTag: "#things",
};

export const updateTaskCache = StateEffect.define<TaskCacheState>();

export const taskCacheField = StateField.define<TaskCacheState>({
    create() {
        return EMPTY_CACHE;
    },
    update(value, tr) {
        for (const effect of tr.effects) {
            if (effect.is(updateTaskCache)) {
                return effect.value;
            }
        }
        return value;
    },
});

export function buildCacheState(
    tasks: ThingsTask[],
    settings: ThingsSyncSettings
): TaskCacheState {
    const map = new Map<string, ThingsTask>();
    for (const task of tasks) {
        map.set(task.uuid, task);
    }
    return {
        tasks: map,
        showProject: settings.showProject,
        showDeadline: settings.showDeadline,
        showArea: settings.showArea,
        showStartDate: settings.showStartDate,
        showTags: settings.showTags,
        displayMode: settings.displayMode,
        syncTag: settings.syncTag,
    };
}
