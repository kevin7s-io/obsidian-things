import { spawn } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import Papa from "papaparse";
import { ThingsTask, ThingsStatus, ThingsItemType, ThingsStart } from "./types";

const THINGS_BASE_DIR = "~/Library/Group Containers/JLMPQHK86H.com.culturedcode.ThingsMac/";

export function decodeThingsDate(encoded: number | null): string | null {
    if (!encoded) return null;
    const year = (encoded >> 16) & 0x7FF;
    const month = (encoded >> 12) & 0xF;
    const day = (encoded >> 7) & 0x1F;
    if (year === 0 || month === 0 || day === 0) return null;
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
}

export function findThingsDbPath(baseDir?: string): string {
    const resolvedBase = (baseDir || THINGS_BASE_DIR).replace("~", os.homedir());
    try {
        const entries = fs.readdirSync(resolvedBase);
        const dataDir = entries.find((e) => e.startsWith("ThingsData"));
        if (!dataDir) return "";
        return path.join(
            resolvedBase,
            dataDir,
            "Things Database.thingsdatabase",
            "main.sqlite"
        );
    } catch {
        return "";
    }
}

interface SpawnResult {
    stdout: string;
    stderr: string;
    code: number;
}

async function runSqlite(dbPath: string, query: string): Promise<SpawnResult> {
    return new Promise((resolve) => {
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        const child = spawn(
            "sqlite3",
            [dbPath, "-header", "-csv", "-readonly", query],
            { detached: true }
        );

        child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
        child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
        child.on("error", (err: Error) => {
            stderrChunks.push(Buffer.from(String(err.stack), "ascii"));
        });
        child.on("close", (code: number) => {
            resolve({
                stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
                stderr: Buffer.concat(stderrChunks).toString("utf-8"),
                code: code ?? 1,
            });
        });
    });
}

function parseCSV<T>(csv: string): T[] {
    return Papa.parse<T>(csv, {
        dynamicTyping: false,
        header: true,
        newline: "\n",
        skipEmptyLines: true,
    }).data;
}

interface RawTaskRow {
    uuid: string;
    title: string;
    status: string;
    type: string;
    notes: string;
    project: string;
    projectTitle: string;
    area: string;
    areaTitle: string;
    tag: string;
    startDate: string;
    deadline: string;
    stopDate: string;
    creationDate: string;
    userModificationDate: string;
    start: string;
    trashed: string;
}

function rowToTask(row: RawTaskRow): ThingsTask {
    return {
        uuid: row.uuid,
        title: row.title,
        status: Number(row.status) as ThingsStatus,
        type: Number(row.type) as ThingsItemType,
        notes: row.notes || "",
        project: row.project || null,
        projectTitle: row.projectTitle || null,
        area: row.area || null,
        areaTitle: row.areaTitle || null,
        tags: [],
        startDate: decodeThingsDate(Number(row.startDate) || null),
        deadline: decodeThingsDate(Number(row.deadline) || null),
        stopDate: Number(row.stopDate) || null,
        creationDate: Number(row.creationDate),
        userModificationDate: Number(row.userModificationDate),
        start: Number(row.start) as ThingsStart,
        trashed: row.trashed === "1",
    };
}

const TASKS_QUERY = `
SELECT
    T.uuid, T.title, T.status, T.type, T.notes,
    T.project, P.title as projectTitle,
    T.area, A.title as areaTitle,
    GROUP_CONCAT(TG.title) as tag,
    T.startDate, T.deadline, T.stopDate,
    T.creationDate, T.userModificationDate,
    T.start, T.trashed
FROM TMTask T
LEFT JOIN TMTask P ON P.uuid = T.project
LEFT JOIN TMArea A ON A.uuid = T.area
LEFT JOIN TMTaskTag TT ON TT.tasks = T.uuid
LEFT JOIN TMTag TG ON TG.uuid = TT.tags
WHERE T.trashed = 0 AND T.type = 0
GROUP BY T.uuid
`;

export async function readAllTasks(dbPath: string): Promise<ThingsTask[]> {
    const result = await runSqlite(dbPath, TASKS_QUERY);
    if (result.stderr) {
        throw new Error(`SQLite error: ${result.stderr}`);
    }
    const rows = parseCSV<RawTaskRow>(result.stdout);
    return rows.map((row) => {
        const task = rowToTask(row);
        task.tags = row.tag ? row.tag.split(",").map((t) => t.trim()) : [];
        return task;
    });
}

export async function readTasksSince(
    dbPath: string,
    sinceTimestamp: number
): Promise<ThingsTask[]> {
    const query = `${TASKS_QUERY} HAVING T.userModificationDate > ${sinceTimestamp}`;
    const result = await runSqlite(dbPath, query);
    if (result.stderr) {
        throw new Error(`SQLite error: ${result.stderr}`);
    }
    const rows = parseCSV<RawTaskRow>(result.stdout);
    return rows.map((row) => {
        const task = rowToTask(row);
        task.tags = row.tag ? row.tag.split(",").map((t) => t.trim()) : [];
        return task;
    });
}
