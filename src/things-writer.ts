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

export async function getTaskUuid(title: string): Promise<string> {
    const escaped = escapeAppleScript(title);
    const script = `tell application "Things3" to get id of to do named "${escaped}"`;
    const result = await runAppleScript(script);
    if (result.stderr) {
        throw new Error(`AppleScript error: ${result.stderr}`);
    }
    return result.stdout;
}
