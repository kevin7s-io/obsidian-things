import { execFile, spawn } from "child_process";
import { runAppleScript, escapeAppleScript, validateUuid } from "./things-bridge";

export function buildCreateScript(title: string, project?: string): string {
    const escapedTitle = escapeAppleScript(title);
    let props = `name:"${escapedTitle}"`;
    if (project && project !== "Inbox") {
        props += `, project:project "${escapeAppleScript(project)}"`;
    }
    return `tell application "Things3" to make new to do with properties {${props}}`;
}

export function buildCompleteScript(uuid: string): string {
    validateUuid(uuid);
    return `tell application "Things3" to set status of to do id "${uuid}" to completed`;
}

export function buildReopenScript(uuid: string): string {
    validateUuid(uuid);
    return `tell application "Things3" to set status of to do id "${uuid}" to open`;
}

export function buildUpdateTitleScript(uuid: string, title: string): string {
    validateUuid(uuid);
    const escaped = escapeAppleScript(title);
    return `tell application "Things3" to set name of to do id "${uuid}" to "${escaped}"`;
}

export async function createTask(
    title: string,
    project?: string
): Promise<string> {
    const script = buildCreateScript(title, project);
    const result = await runAppleScript(script);
    if (result.stderr) {
        throw new Error(`AppleScript error: ${result.stderr}`);
    }
    // AppleScript returns "to do id XXXX" — strip the prefix
    return result.stdout.replace(/^to do id /, "");
}

export async function completeTask(uuid: string): Promise<void> {
    const result = await runAppleScript(buildCompleteScript(uuid));
    if (result.stderr) {
        throw new Error(`AppleScript error: ${result.stderr}`);
    }
}

export async function reopenTask(uuid: string): Promise<void> {
    const result = await runAppleScript(buildReopenScript(uuid));
    if (result.stderr) {
        throw new Error(`AppleScript error: ${result.stderr}`);
    }
}

export async function updateTaskTitle(
    uuid: string,
    title: string
): Promise<void> {
    const result = await runAppleScript(buildUpdateTitleScript(uuid, title));
    if (result.stderr) {
        throw new Error(`AppleScript error: ${result.stderr}`);
    }
}

export function buildUpdateNotesScript(uuid: string, notes: string): string {
    validateUuid(uuid);
    if (notes === "") {
        return `tell application "Things3" to set notes of to do id "${uuid}" to ""`;
    }
    // AppleScript doesn't support \n escapes — join lines with linefeed constant
    const lines = notes.split("\n");
    const escapedLines = lines.map((l) => `"${escapeAppleScript(l)}"`);
    const notesExpr = escapedLines.join(" & linefeed & ");
    return `tell application "Things3" to set notes of to do id "${uuid}" to ${notesExpr}`;
}

export function buildUpdateUrl(
    authToken: string,
    uuid: string,
    params: Record<string, string>
): string {
    validateUuid(uuid);
    const query = new URLSearchParams({
        "auth-token": authToken,
        id: uuid,
        ...params,
    });
    return `things:///update?${query.toString()}`;
}

export function buildUpdateTagsScript(uuid: string, tags: string[]): string {
    validateUuid(uuid);
    const tagStr = tags.map((t) => escapeAppleScript(t)).join(", ");
    return `tell application "Things3" to set tag names of to do id "${uuid}" to "${tagStr}"`;
}

export async function updateTaskTags(uuid: string, tags: string[]): Promise<void> {
    const result = await runAppleScript(buildUpdateTagsScript(uuid, tags));
    if (result.stderr) {
        throw new Error(`AppleScript error: ${result.stderr}`);
    }
}

export async function updateTaskNotes(uuid: string, notes: string): Promise<void> {
    const result = await runAppleScript(buildUpdateNotesScript(uuid, notes));
    if (result.stderr) {
        throw new Error(`AppleScript error: ${result.stderr}`);
    }
}

export async function updateTaskDates(
    authToken: string,
    uuid: string,
    startDate: string | null,
    deadline: string | null
): Promise<void> {
    if (!authToken) {
        throw new Error("Things auth token not configured. Set it in plugin settings.");
    }
    const params: Record<string, string> = {};
    // "when" sets the scheduled date; empty string clears it
    if (startDate !== undefined) params.when = startDate ?? "";
    if (deadline !== undefined) params.deadline = deadline ?? "";
    if (Object.keys(params).length === 0) return;

    const url = buildUpdateUrl(authToken, uuid, params);
    return new Promise((resolve, reject) => {
        execFile("open", ["-g", url], (err) => {
            if (err) reject(new Error(`Failed to open Things URL: ${err.message}`));
            else resolve();
        });
    });
}

export function launchThingsInBackground(): void {
    const child = spawn("open", ["-g", "-a", "Things3"]);
    child.on("error", (err) => {
        console.warn("[Things Sync] Failed to launch Things:", err.message);
    });
}

export async function getTaskUuid(title: string): Promise<string> {
    const escaped = escapeAppleScript(title);
    const script = `tell application "Things3" to get id of to do named "${escaped}"`;
    const result = await runAppleScript(script);
    if (result.stderr) {
        throw new Error(`AppleScript error: ${result.stderr}`);
    }
    return result.stdout;
}
