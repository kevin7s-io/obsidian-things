import { spawn } from "child_process";

export interface ScriptResult {
    stdout: string;
    stderr: string;
    code: number;
}

export function escapeAppleScript(str: string): string {
    return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const UUID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export function validateUuid(uuid: string): string {
    if (!UUID_PATTERN.test(uuid)) {
        throw new Error(`Invalid Things UUID: ${uuid}`);
    }
    return uuid;
}

export async function runAppleScript(script: string): Promise<ScriptResult> {
    return runOsascript(["-e", script]);
}

export async function runJXA(script: string): Promise<ScriptResult> {
    return runOsascript(["-l", "JavaScript", "-e", script]);
}

export async function isThingsRunning(): Promise<boolean> {
    const result = await runAppleScript(
        'tell application "System Events" to return (name of processes) contains "Things3"'
    );
    return result.stdout === "true";
}

function runOsascript(args: string[]): Promise<ScriptResult> {
    return new Promise((resolve) => {
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        const child = spawn("osascript", args, { detached: true });

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
