import { Plugin } from "obsidian";

export default class ThingsSyncPlugin extends Plugin {
	async onload() {
		console.log("Things Sync: loading");
	}

	onunload() {
		console.log("Things Sync: unloading");
	}
}
