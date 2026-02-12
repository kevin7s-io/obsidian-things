import { describe, it, expect } from "vitest";
import { escapeAppleScript } from "./things-bridge";

describe("escapeAppleScript", () => {
    it("passes a basic string through unchanged", () => {
        expect(escapeAppleScript("hello world")).toBe("hello world");
    });

    it("escapes backslashes", () => {
        expect(escapeAppleScript("path\\to\\file")).toBe("path\\\\to\\\\file");
    });

    it("escapes double quotes", () => {
        expect(escapeAppleScript('say "hello"')).toBe('say \\"hello\\"');
    });

    it("strips carriage returns", () => {
        expect(escapeAppleScript("line1\r\nline2")).toBe("line1\nline2");
    });

    it("strips null bytes", () => {
        expect(escapeAppleScript("before\0after")).toBe("beforeafter");
    });

    it("handles combined edge cases", () => {
        const input = 'a\\b\r\n"c"\0d';
        const expected = 'a\\\\b\n\\"c\\"d';
        expect(escapeAppleScript(input)).toBe(expected);
    });
});
