import { App, PluginSettingTab, Setting } from "obsidian";
import type ThingsSyncPlugin from "./main";
import { ThingsSyncSettings } from "./types";

export class ThingsSyncSettingTab extends PluginSettingTab {
    plugin: ThingsSyncPlugin;

    constructor(app: App, plugin: ThingsSyncPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Connection
        containerEl.createEl("h3", { text: "Connection" });

        new Setting(containerEl)
            .setName("Sync interval (seconds)")
            .setDesc("How often to sync with Things. Range: 10-300")
            .addSlider((slider) =>
                slider
                    .setLimits(10, 300, 5)
                    .setValue(this.plugin.settings.syncIntervalSeconds)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.syncIntervalSeconds = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Sync on startup")
            .setDesc("Run a full sync when Obsidian launches")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.syncOnStartup)
                    .onChange(async (value) => {
                        this.plugin.settings.syncOnStartup = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Task Format
        containerEl.createEl("h3", { text: "Task Format" });

        new Setting(containerEl)
            .setName("Sync tag")
            .setDesc("Tag that marks a checkbox for sync (e.g. #things, #task)")
            .addText((text) =>
                text
                    .setPlaceholder("#things")
                    .setValue(this.plugin.settings.syncTag)
                    .onChange(async (value) => {
                        this.plugin.settings.syncTag = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Display mode")
            .setDesc("How linked Things tasks appear in notes")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("inline", "Inline badges")
                    .addOption("card", "Card (Things 3 style)")
                    .setValue(this.plugin.settings.displayMode)
                    .onChange(async (value: string) => {
                        this.plugin.settings.displayMode = value as "inline" | "card";
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Show project in tasks")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showProject)
                    .onChange(async (value) => {
                        this.plugin.settings.showProject = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Show deadline in tasks")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showDeadline)
                    .onChange(async (value) => {
                        this.plugin.settings.showDeadline = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Show area in tasks")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showArea)
                    .onChange(async (value) => {
                        this.plugin.settings.showArea = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Show start date in tasks")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showStartDate)
                    .onChange(async (value) => {
                        this.plugin.settings.showStartDate = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Show tags in tasks")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showTags)
                    .onChange(async (value) => {
                        this.plugin.settings.showTags = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Sync Behavior
        containerEl.createEl("h3", { text: "Sync Behavior" });

        new Setting(containerEl)
            .setName("Conflict resolution")
            .setDesc("When both Obsidian and Things changed since last sync")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("things", "Things wins")
                    .addOption("obsidian", "Obsidian wins")
                    .setValue(this.plugin.settings.conflictResolution)
                    .onChange(async (value: string) => {
                        this.plugin.settings.conflictResolution = value as "things" | "obsidian";
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Auto-create in Things")
            .setDesc("Automatically push new tagged checkboxes to Things")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.autoCreate)
                    .onChange(async (value) => {
                        this.plugin.settings.autoCreate = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Default project")
            .setDesc("Where new tasks from Obsidian land in Things")
            .addText((text) =>
                text
                    .setPlaceholder("Inbox")
                    .setValue(this.plugin.settings.defaultProject)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultProject = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Advanced
        containerEl.createEl("h3", { text: "Advanced" });

        new Setting(containerEl)
            .setName("Debug logging")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.debugLogging)
                    .onChange(async (value) => {
                        this.plugin.settings.debugLogging = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Dry run mode")
            .setDesc("Show what sync would do without actually writing")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.dryRun)
                    .onChange(async (value) => {
                        this.plugin.settings.dryRun = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}
