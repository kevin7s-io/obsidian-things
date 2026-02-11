import { describe, it, expect } from "vitest";
import { decodeThingsDate, findThingsDbPath } from "./things-reader";

describe("decodeThingsDate", () => {
    it("returns null for null/zero input", () => {
        expect(decodeThingsDate(null)).toBeNull();
        expect(decodeThingsDate(0)).toBeNull();
    });

    it("decodes a known date correctly", () => {
        // Things encodes dates as: year << 16 | month << 12 | day << 7
        const encoded = (2026 << 16) | (2 << 12) | (10 << 7);
        expect(decodeThingsDate(encoded)).toBe("2026-02-10");
    });

    it("decodes another date correctly", () => {
        const encoded = (2025 << 16) | (12 << 12) | (25 << 7);
        expect(decodeThingsDate(encoded)).toBe("2025-12-25");
    });

    it("pads single-digit months and days", () => {
        const encoded = (2026 << 16) | (1 << 12) | (5 << 7);
        expect(decodeThingsDate(encoded)).toBe("2026-01-05");
    });
});

describe("findThingsDbPath", () => {
    it("returns empty string when base dir does not exist", () => {
        const result = findThingsDbPath("/nonexistent/path");
        expect(result).toBe("");
    });
});
