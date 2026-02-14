import { describe, it, expect } from "vitest";
import { parseLine, buildTaskLine, buildPlainTaskLine, scanFileContent } from "./markdown-scanner";

describe("parseLine", () => {
    const tag = "#things";

    it("parses an unchecked task with no UUID", () => {
        const result = parseLine("- [ ] Buy groceries #things", tag);
        expect(result).not.toBeNull();
        expect(result!.checked).toBe(false);
        expect(result!.title).toBe("Buy groceries");
        expect(result!.uuid).toBeNull();
        expect(result!.indent).toBe("");
    });

    it("parses a checked task with UUID", () => {
        const result = parseLine(
            "- [x] Call dentist #things <!-- things:ABC-123 -->",
            tag
        );
        expect(result).not.toBeNull();
        expect(result!.checked).toBe(true);
        expect(result!.title).toBe("Call dentist");
        expect(result!.uuid).toBe("ABC-123");
        expect(result!.indent).toBe("");
    });

    it("parses a task with project and deadline metadata", () => {
        const result = parseLine(
            "- [ ] Fix bug #things (Work) 📅 2026-03-01 <!-- things:DEF-456 -->",
            tag
        );
        expect(result).not.toBeNull();
        expect(result!.title).toBe("Fix bug");
        expect(result!.uuid).toBe("DEF-456");
    });

    it("returns null for non-tagged checkbox", () => {
        const result = parseLine("- [ ] Regular task", tag);
        expect(result).toBeNull();
    });

    it("returns null for non-checkbox line", () => {
        const result = parseLine("Some text #things", tag);
        expect(result).toBeNull();
    });

    it("works with custom tag", () => {
        const result = parseLine("- [ ] My task #task", "#task");
        expect(result).not.toBeNull();
        expect(result!.title).toBe("My task");
    });

    it("parses tag at beginning of body", () => {
        const result = parseLine("- [ ] #things Buy groceries", tag);
        expect(result).not.toBeNull();
        expect(result!.checked).toBe(false);
        expect(result!.title).toBe("Buy groceries");
        expect(result!.uuid).toBeNull();
    });

    it("parses tag in middle of body", () => {
        const result = parseLine("- [ ] Buy #things groceries", tag);
        expect(result).not.toBeNull();
        expect(result!.checked).toBe(false);
        expect(result!.title).toBe("Buy groceries");
        expect(result!.uuid).toBeNull();
    });

    it("rejects partial tag match", () => {
        const result = parseLine("- [ ] Nothingshere #thingsmore", tag);
        expect(result).toBeNull();
    });

    it("parses tag at beginning with UUID", () => {
        const result = parseLine(
            "- [ ] #things Buy groceries <!-- things:ABC-123 -->",
            tag
        );
        expect(result).not.toBeNull();
        expect(result!.title).toBe("Buy groceries");
        expect(result!.uuid).toBe("ABC-123");
    });

    it("parses an indented task with 2-space indent", () => {
        const result = parseLine(
            "  - [ ] Indented task #things <!-- things:UUID-1 -->",
            tag
        );
        expect(result).not.toBeNull();
        expect(result!.checked).toBe(false);
        expect(result!.title).toBe("Indented task");
        expect(result!.uuid).toBe("UUID-1");
        expect(result!.indent).toBe("  ");
    });

    it("parses a deeply indented checked task with 4-space indent", () => {
        const result = parseLine(
            "    - [x] Deep indent #things <!-- things:UUID-2 -->",
            tag
        );
        expect(result).not.toBeNull();
        expect(result!.checked).toBe(true);
        expect(result!.title).toBe("Deep indent");
        expect(result!.uuid).toBe("UUID-2");
        expect(result!.indent).toBe("    ");
    });
});

describe("buildTaskLine", () => {
    it("builds a basic task line", () => {
        const line = buildTaskLine({
            checked: false,
            title: "Buy groceries",
            uuid: "ABC-123",
            tag: "#things",
        });
        expect(line).toBe("- [ ] Buy groceries #things <!-- things:ABC-123 -->");
    });

    it("builds a checked task line", () => {
        const line = buildTaskLine({
            checked: true,
            title: "Done task",
            uuid: "DEF-456",
            tag: "#things",
        });
        expect(line).toBe("- [x] Done task #things <!-- things:DEF-456 -->");
    });

    it("builds a clean line without inline metadata", () => {
        const line = buildTaskLine({
            checked: false,
            title: "Fix bug",
            uuid: "GHI-789",
            tag: "#things",
        });
        expect(line).toBe("- [ ] Fix bug #things <!-- things:GHI-789 -->");
    });

    it("preserves indentation when indent is provided", () => {
        const line = buildTaskLine({
            checked: false,
            title: "Subtask",
            uuid: "IND-001",
            tag: "#things",
            indent: "    ",
        });
        expect(line).toBe("    - [ ] Subtask #things <!-- things:IND-001 -->");
    });
});

describe("buildPlainTaskLine", () => {
    it("builds an unchecked plain task line", () => {
        const line = buildPlainTaskLine({ checked: false, title: "Buy groceries" });
        expect(line).toBe("- [ ] Buy groceries");
    });

    it("builds a checked plain task line", () => {
        const line = buildPlainTaskLine({ checked: true, title: "Done task" });
        expect(line).toBe("- [x] Done task");
    });

    it("builds an indented plain task line", () => {
        const line = buildPlainTaskLine({ checked: false, title: "Subtask", indent: "    " });
        expect(line).toBe("    - [ ] Subtask");
    });
});

describe("parseLine backward compat", () => {
    const tag = "#things";

    it("parses old format with project, deadline, and area", () => {
        const result = parseLine(
            "- [ ] Fix bug #things (Work) 📅 2026-03-01 [Personal] <!-- things:DEF-456 -->",
            tag
        );
        expect(result).not.toBeNull();
        expect(result!.title).toBe("Fix bug");
        expect(result!.uuid).toBe("DEF-456");
    });

    it("parses new clean format", () => {
        const result = parseLine(
            "- [ ] Fix bug #things <!-- things:DEF-456 -->",
            tag
        );
        expect(result).not.toBeNull();
        expect(result!.title).toBe("Fix bug");
        expect(result!.uuid).toBe("DEF-456");
    });
});

describe("scanFileContent with indented tasks", () => {
    const tag = "#things";

    it("finds indented tasks in file content", () => {
        const content = [
            "- [ ] Top-level #things <!-- things:TOP-1 -->",
            "  - [ ] Subtask #things <!-- things:SUB-1 -->",
            "    - [x] Deep subtask #things <!-- things:DEEP-1 -->",
            "Some plain text",
        ].join("\n");

        const tasks = scanFileContent(content, "test.md", tag);
        expect(tasks).toHaveLength(3);

        expect(tasks[0]!.title).toBe("Top-level");
        expect(tasks[0]!.indent).toBe("");
        expect(tasks[0]!.line).toBe(0);

        expect(tasks[1]!.title).toBe("Subtask");
        expect(tasks[1]!.indent).toBe("  ");
        expect(tasks[1]!.line).toBe(1);

        expect(tasks[2]!.title).toBe("Deep subtask");
        expect(tasks[2]!.indent).toBe("    ");
        expect(tasks[2]!.checked).toBe(true);
        expect(tasks[2]!.line).toBe(2);
    });
});
