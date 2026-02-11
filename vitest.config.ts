import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		alias: {
			obsidian: path.resolve(__dirname, "src/__mocks__/obsidian.ts"),
		},
	},
});
