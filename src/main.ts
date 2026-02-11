import { Plugin } from "obsidian";
import { ThingsSyncSettings, DEFAULT_SETTINGS } from "./types";

export default class ThingsSyncPlugin extends Plugin {
	settings: ThingsSyncSettings = DEFAULT_SETTINGS;

	async onload() {
		console.log("Things Sync: loading");
	}

	onunload() {
		console.log("Things Sync: unloading");
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
