export interface ThingsTask {
    uuid: string;
    title: string;
    status: ThingsStatus;
    type: ThingsItemType;
    notes: string;
    project: string | null;
    projectTitle: string | null;
    area: string | null;
    areaTitle: string | null;
    tags: string[];
    startDate: string | null;
    deadline: string | null;
    stopDate: number | null;
    creationDate: number;
    userModificationDate: number;
    start: ThingsStart;
    trashed: boolean;
}

export enum ThingsStatus {
    Open = 0,
    Canceled = 2,
    Completed = 3,
}

export enum ThingsItemType {
    Todo = 0,
    Project = 1,
    Heading = 2,
}

export enum ThingsStart {
    Inbox = 0,
    Anytime = 1,
    Someday = 2,
}

export interface TrackedTask {
    uuid: string;
    filePath: string;
    line: number;
    checked: boolean;
    title: string;
    lastSyncTimestamp: number;
}

export interface SyncState {
    lastSyncTimestamp: number;
    tasks: Record<string, TrackedTask>;
}

export interface ScannedTask {
    filePath: string;
    line: number;
    checked: boolean;
    title: string;
    uuid: string | null;
    rawLine: string;
}

export interface ThingsSyncSettings {
    dbPath: string;
    syncIntervalSeconds: number;
    syncOnStartup: boolean;
    syncTag: string;
    showProject: boolean;
    showDeadline: boolean;
    showArea: boolean;
    conflictResolution: "things" | "obsidian";
    syncCompleted: boolean;
    autoCreate: boolean;
    defaultProject: string;
    defaultTags: string;
    debugLogging: boolean;
    dryRun: boolean;
}

export const DEFAULT_SETTINGS: ThingsSyncSettings = {
    dbPath: "",
    syncIntervalSeconds: 30,
    syncOnStartup: true,
    syncTag: "#things",
    showProject: true,
    showDeadline: true,
    showArea: false,
    conflictResolution: "things",
    syncCompleted: true,
    autoCreate: true,
    defaultProject: "Inbox",
    defaultTags: "",
    debugLogging: false,
    dryRun: false,
};
