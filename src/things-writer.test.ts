import { describe, it, expect } from "vitest";
import { buildCreateScript, buildCompleteScript, buildReopenScript } from "./things-writer";

describe("buildCreateScript", () => {
    it("builds a create script with title only", () => {
        const script = buildCreateScript("Buy groceries");
        expect(script).toContain('make new to do');
        expect(script).toContain('name:"Buy groceries"');
    });

    it("escapes double quotes in title", () => {
        const script = buildCreateScript('Read "The Book"');
        expect(script).toContain('name:"Read \\"The Book\\""');
    });
});

describe("buildCompleteScript", () => {
    it("builds a complete script", () => {
        const script = buildCompleteScript("ABC-123");
        expect(script).toContain('set status of to do id "ABC-123" to completed');
    });
});

describe("buildReopenScript", () => {
    it("builds a reopen script", () => {
        const script = buildReopenScript("ABC-123");
        expect(script).toContain('set status of to do id "ABC-123" to open');
    });
});
