import { describe, it, expect } from "vitest";
import { parseLine, buildTaskLine, extractTagFromLine } from "./markdown-scanner";

describe("parseLine", () => {
    const tag = "#things";

    it("parses an unchecked task with no UUID", () => {
        const result = parseLine("- [ ] Buy groceries #things", tag);
        expect(result).not.toBeNull();
        expect(result!.checked).toBe(false);
        expect(result!.title).toBe("Buy groceries");
        expect(result!.uuid).toBeNull();
    });

    it("parses a checked task with UUID", () => {
        const result = parseLine(
            "- [x] Call dentist #things %%things:ABC-123%%",
            tag
        );
        expect(result).not.toBeNull();
        expect(result!.checked).toBe(true);
        expect(result!.title).toBe("Call dentist");
        expect(result!.uuid).toBe("ABC-123");
    });

    it("parses a task with project and deadline metadata", () => {
        const result = parseLine(
            "- [ ] Fix bug #things (Work) 📅 2026-03-01 %%things:DEF-456%%",
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
            "- [ ] #things Buy groceries %%things:ABC-123%%",
            tag
        );
        expect(result).not.toBeNull();
        expect(result!.title).toBe("Buy groceries");
        expect(result!.uuid).toBe("ABC-123");
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
        expect(line).toBe("- [ ] Buy groceries #things %%things:ABC-123%%");
    });

    it("builds a checked task line", () => {
        const line = buildTaskLine({
            checked: true,
            title: "Done task",
            uuid: "DEF-456",
            tag: "#things",
        });
        expect(line).toBe("- [x] Done task #things %%things:DEF-456%%");
    });

    it("builds a line with project and deadline", () => {
        const line = buildTaskLine({
            checked: false,
            title: "Fix bug",
            uuid: "GHI-789",
            tag: "#things",
            projectTitle: "Work",
            deadline: "2026-03-01",
        });
        expect(line).toBe(
            "- [ ] Fix bug #things (Work) 📅 2026-03-01 %%things:GHI-789%%"
        );
    });
});
