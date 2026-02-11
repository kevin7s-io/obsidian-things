import { spawn } from "child_process";

interface AppleScriptResult {
    stdout: string;
    stderr: string;
    code: number;
}

async function runAppleScript(script: string): Promise<AppleScriptResult> {
    return new Promise((resolve) => {
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        const child = spawn("osascript", ["-e", script], { detached: true });

        child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
        child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
        child.on("error", (err: Error) => {
            stderrChunks.push(Buffer.from(String(err.stack), "ascii"));
        });
        child.on("close", (code: number) => {
            resolve({
                stdout: Buffer.concat(stdoutChunks).toString("utf-8").trim(),
                stderr: Buffer.concat(stderrChunks).toString("utf-8").trim(),
                code: code ?? 1,
            });
        });
    });
}

function escapeAppleScript(str: string): string {
    return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const UUID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

function validateUuid(uuid: string): string {
    if (!UUID_PATTERN.test(uuid)) {
        throw new Error(`Invalid Things UUID: ${uuid}`);
    }
    return uuid;
}

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
    return result.stdout;
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
