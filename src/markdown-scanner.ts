import { ScannedTask } from "./types";

interface ParsedLine {
    checked: boolean;
    title: string;
    uuid: string | null;
}

export function parseLine(line: string, tag: string): ParsedLine | null {
    const checkboxMatch = line.match(/^- \[([ x])\] (.+)$/);
    if (!checkboxMatch) return null;

    const checked = checkboxMatch[1] === "x";
    let body = checkboxMatch[2]!;

    // Tag must be present (as whole word, not substring like #thingsmore)
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tagRegex = new RegExp(`${escapedTag}(?:\\s|$)`);
    if (!tagRegex.test(body)) return null;

    // Extract UUID
    const uuidMatch = body.match(/<!--\s*things:(.+?)\s*-->/);
    const uuid = uuidMatch ? uuidMatch[1]!.trim().replace(/^to do id /, "") : null;

    // Build title: remove UUID comment, tag, and post-tag metadata
    let title = body;
    title = title.replace(/<!--\s*things:.+?\s*-->/, "");  // remove UUID
    title = title.replace(tagRegex, " ");             // remove tag
    title = title.replace(/\s*\(.*?\)\s*/g, " ");    // remove (Project)
    title = title.replace(/\s*📅\s*\S+/g, "");       // remove deadline
    title = title.replace(/\s*\[.*?\]\s*/g, " ");    // remove [Area]
    title = title.replace(/\s{2,}/g, " ");              // collapse whitespace
    title = title.trim();

    return { checked, title, uuid };
}

interface BuildTaskLineOpts {
    checked: boolean;
    title: string;
    uuid: string;
    tag: string;
}

export function buildTaskLine(opts: BuildTaskLineOpts): string {
    const checkbox = opts.checked ? "[x]" : "[ ]";
    return `- ${checkbox} ${opts.title} ${opts.tag} <!-- things:${opts.uuid} -->`;
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
