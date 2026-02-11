import { ScannedTask } from "./types";

interface ParsedLine {
    checked: boolean;
    title: string;
    uuid: string | null;
}

export function parseLine(line: string, tag: string): ParsedLine | null {
    // Escape special regex chars in the tag
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const regex = new RegExp(
        `^- \\[([ x])\\] (.+?)\\s*${escapedTag}(?:\\s.*?)?(?:\\s*%%things:([^%]+)%%)?\\s*$`
    );

    const match = line.match(regex);
    if (!match) return null;

    const checked = match[1] === "x";
    const title = match[2]!.trim();
    const uuid = match[3] || null;

    return { checked, title, uuid };
}

interface BuildTaskLineOpts {
    checked: boolean;
    title: string;
    uuid: string;
    tag: string;
    projectTitle?: string;
    deadline?: string | null;
    areaTitle?: string;
}

export function buildTaskLine(opts: BuildTaskLineOpts): string {
    const checkbox = opts.checked ? "[x]" : "[ ]";
    let line = `- ${checkbox} ${opts.title} ${opts.tag}`;

    if (opts.projectTitle) {
        line += ` (${opts.projectTitle})`;
    }
    if (opts.deadline) {
        line += ` \u{1F4C5} ${opts.deadline}`;
    }
    if (opts.areaTitle) {
        line += ` [${opts.areaTitle}]`;
    }

    line += ` %%things:${opts.uuid}%%`;
    return line;
}

export function extractTagFromLine(line: string, tag: string): boolean {
    return line.includes(tag);
}

export interface VaultScanner {
    scanFile(
        content: string,
        filePath: string,
        tag: string
    ): ScannedTask[];
}

export function scanFileContent(
    content: string,
    filePath: string,
    tag: string
): ScannedTask[] {
    const lines = content.split("\n");
    const tasks: ScannedTask[] = [];

    for (let i = 0; i < lines.length; i++) {
        const parsed = parseLine(lines[i]!, tag);
        if (parsed) {
            tasks.push({
                filePath,
                line: i,
                checked: parsed.checked,
                title: parsed.title,
                uuid: parsed.uuid,
                rawLine: lines[i]!,
            });
        }
    }

    return tasks;
}
