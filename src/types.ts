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
    inTodayList: boolean;
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
    indent?: string;
}

export interface ThingsSyncSettings {
    syncIntervalSeconds: number;
    syncOnStartup: boolean;
    launchThingsOnStartup: boolean;
    syncTag: string;
    showProject: boolean;
    showDeadline: boolean;
    showArea: boolean;
    showStartDate: boolean;
    showTags: boolean;
    displayMode: "inline" | "card";
    conflictResolution: "things" | "obsidian";
    syncCompleted: boolean;
    autoCreate: boolean;
    defaultProject: string;
    defaultTags: string;
    thingsAuthToken: string;
    debugLogging: boolean;
    dryRun: boolean;
}

export const DEFAULT_SETTINGS: ThingsSyncSettings = {
    syncIntervalSeconds: 30,
    syncOnStartup: true,
    launchThingsOnStartup: true,
    syncTag: "#things",
    showProject: true,
    showDeadline: true,
    showArea: false,
    showStartDate: false,
    showTags: true,
    displayMode: "inline",
    conflictResolution: "things",
    syncCompleted: true,
    autoCreate: true,
    defaultProject: "Inbox",
    defaultTags: "",
    thingsAuthToken: "",
    debugLogging: false,
    dryRun: false,
};
