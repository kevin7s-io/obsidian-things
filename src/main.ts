import { Notice, Platform, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { ThingsSyncSettings, DEFAULT_SETTINGS, ThingsTask, ThingsStatus, SyncState, ScannedTask } from "./types";
import { readAllTasks, ThingsNotRunningError } from "./things-reader";
import { createTask, completeTask, reopenTask, updateTaskNotes, updateTaskStartDate, updateTaskDeadline } from "./things-writer";
import { parseLine, buildTaskLine, scanFileContent } from "./markdown-scanner";
import { parseQuery, filterTasks } from "./query-parser";
import { renderListView, renderKanbanView, TaskActionHandler } from "./renderer";
import { reconcile, ReconcileAction } from "./sync-engine";
import { ThingsSyncSettingTab } from "./settings";
import { thingsLinkViewPlugin, createThingsPostProcessor, setEditTaskHandler } from "./things-link-widget";
import { TaskEditModal, TaskMetadataChanges } from "./task-edit-modal";
import { taskCacheField, updateTaskCache, buildCacheState } from "./task-cache-state";

export default class ThingsSyncPlugin extends Plugin {
    settings: ThingsSyncSettings = DEFAULT_SETTINGS;
    taskCache: ThingsTask[] = [];
    taskCacheMap: Map<string, ThingsTask> = new Map();
    syncState: SyncState = { lastSyncTimestamp: 0, tasks: {} };
    syncing = false;

    async onload() {
        await this.loadSettings();

        if (!Platform.isMacOS || !Platform.isDesktopApp) {
            new Notice("Things Sync requires macOS desktop.");
            return;
        }

        // Load sync state (stored alongside settings in data.json)
        const savedData = await this.loadData();
        if (savedData?.syncState) {
            this.syncState = savedData.syncState;
        }

        // Register code block processor
        this.registerMarkdownCodeBlockProcessor("things", (source, el) => {
            const query = parseQuery(source);
            const tasks = filterTasks(this.taskCache, query);

            const handler: TaskActionHandler = {
                onToggle: async (uuid: string, completed: boolean) => {
                    try {
                        if (completed) {
                            await completeTask(uuid);
                        } else {
                            await reopenTask(uuid);
                        }
                        // Update cache optimistically
                        const cached = this.taskCache.find((t) => t.uuid === uuid);
                        if (cached) {
                            cached.status = completed ? ThingsStatus.Completed : ThingsStatus.Open;
                        }
                    } catch (err) {
                        new Notice(`Things Sync: Failed to update task — ${err}`);
                    }
                },
            };

            if (query.view === "kanban") {
                renderKanbanView(el, tasks, query, handler, this.settings.showProject, this.settings.showDeadline);
            } else {
                renderListView(el, tasks, query, handler, this.settings.showProject, this.settings.showDeadline);
            }
        });

        // Edit handler — opens modal, pushes changes to Things
        const openEditModal = (uuid: string, task: ThingsTask) => {
            new TaskEditModal(this.app, task, (u, changes) =>
                this.updateTaskMetadata(u, changes)
            ).open();
        };

        // Register edit handler for ViewPlugin (live preview)
        setEditTaskHandler(openEditModal);

        // Hide UUID text and show clickable Things link icon + metadata badges
        this.registerMarkdownPostProcessor(
            createThingsPostProcessor(
                this.app,
                () => this.taskCacheMap,
                () => this.settings,
                openEditModal
            )
        );
        this.registerEditorExtension([taskCacheField, thingsLinkViewPlugin]);

        // Push cache to newly opened editors
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", () => {
                this.dispatchCacheToEditors();
            })
        );

        // Add command for manual sync
        this.addCommand({
            id: "sync-now",
            name: "Sync with Things 3",
            callback: () => this.runSync(true),
        });

        // Register sync interval
        this.registerInterval(
            window.setInterval(() => this.runSync(), this.settings.syncIntervalSeconds * 1000)
        );

        // Settings tab
        this.addSettingTab(new ThingsSyncSettingTab(this.app, this));

        // Initial sync
        if (this.settings.syncOnStartup) {
            // Delay slightly to let vault finish loading
            setTimeout(() => this.runSync(), 2000);
        }

        this.log("Things Sync loaded");
    }

    onunload() {
        this.log("Things Sync unloaded");
    }

    async runSync(manual = false) {
        if (this.syncing) return;
        this.syncing = true;

        try {
            this.log("Starting sync...");

            // Step 1: Read from Things via JXA
            this.taskCache = await readAllTasks();
            this.log(`Read ${this.taskCache.length} tasks from Things`);

            // Step 2: Scan vault
            const scannedTasks: ScannedTask[] = [];
            const files = this.app.vault.getMarkdownFiles();
            for (const file of files) {
                const content = await this.app.vault.cachedRead(file);
                const tasks = scanFileContent(content, file.path, this.settings.syncTag);
                scannedTasks.push(...tasks);
            }
            this.log(`Scanned ${scannedTasks.length} tagged tasks in vault`);

            // Step 3: Reconcile
            const actions = reconcile(
                scannedTasks,
                this.taskCache,
                this.syncState.tasks,
                this.settings.conflictResolution
            );
            this.log(`Reconciled: ${actions.length} actions`);

            // Step 4: Apply actions
            if (!this.settings.dryRun) {
                for (const action of actions) {
                    await this.applyAction(action);
                }
            } else {
                for (const action of actions) {
                    this.log(`[DRY RUN] Would ${action.type}: ${action.title || action.uuid}`);
                }
            }

            // Step 5: Update sync state
            const now = Date.now() / 1000;
            this.syncState.lastSyncTimestamp = now;
            for (const scanned of scannedTasks) {
                if (scanned.uuid) {
                    this.syncState.tasks[scanned.uuid] = {
                        uuid: scanned.uuid,
                        filePath: scanned.filePath,
                        line: scanned.line,
                        checked: scanned.checked,
                        title: scanned.title,
                        lastSyncTimestamp: now,
                    };
                }
            }
            await this.persistState();
            this.dispatchCacheToEditors();

            this.log("Sync complete");
        } catch (err) {
            if (err instanceof ThingsNotRunningError) {
                this.log("Things 3 is not running, skipping sync");
                if (manual) {
                    new Notice("Things 3 is not running. Please open Things to sync.");
                }
            } else {
                console.error("Things Sync error:", err);
                new Notice(`Things Sync error: ${err}`);
            }
        } finally {
            this.syncing = false;
        }
    }

    async applyAction(action: ReconcileAction) {
        switch (action.type) {
            case "create-in-things": {
                if (!this.settings.autoCreate) return;
                this.log(`Creating task in Things: ${action.title}`);
                const result = await createTask(action.title!, this.settings.defaultProject);
                // Write UUID back to Obsidian
                const uuid = result.trim();
                if (action.filePath !== undefined && action.line !== undefined && action.scannedTask) {
                    const file = this.app.vault.getAbstractFileByPath(action.filePath);
                    if (file instanceof TFile) {
                        await this.app.vault.process(file, (content: string) => {
                            const lines = content.split("\n");
                            if (lines[action.line!]) {
                                lines[action.line!] = buildTaskLine({
                                    checked: action.scannedTask!.checked,
                                    title: action.scannedTask!.title,
                                    uuid,
                                    tag: this.settings.syncTag,
                                });
                            }
                            return lines.join("\n");
                        });
                    }
                    // Track immediately so next sync recognizes this task
                    this.syncState.tasks[uuid] = {
                        uuid,
                        filePath: action.filePath,
                        line: action.line,
                        checked: action.scannedTask!.checked,
                        title: action.scannedTask!.title,
                        lastSyncTimestamp: Date.now() / 1000,
                    };
                }
                break;
            }

            case "complete-in-things": {
                this.log(`Completing task in Things: ${action.uuid}`);
                await completeTask(action.uuid!);
                break;
            }

            case "reopen-in-things": {
                this.log(`Reopening task in Things: ${action.uuid}`);
                await reopenTask(action.uuid!);
                break;
            }

            case "complete-in-obsidian":
            case "reopen-in-obsidian": {
                const checked = action.type === "complete-in-obsidian";
                this.log(`${checked ? "Completing" : "Reopening"} task in Obsidian: ${action.uuid}`);
                if (action.filePath !== undefined && action.line !== undefined && action.thingsTask) {
                    const file = this.app.vault.getAbstractFileByPath(action.filePath);
                    if (file instanceof TFile) {
                        await this.app.vault.process(file, (content: string) => {
                            const lines = content.split("\n");
                            if (lines[action.line!]) {
                                lines[action.line!] = buildTaskLine({
                                    checked,
                                    title: action.thingsTask!.title,
                                    uuid: action.uuid!,
                                    tag: this.settings.syncTag,
                                });
                            }
                            return lines.join("\n");
                        });
                    }
                }
                break;
            }

            case "update-in-obsidian": {
                this.log(`Updating task in Obsidian: ${action.uuid}`);
                if (action.filePath !== undefined && action.line !== undefined && action.thingsTask) {
                    const file = this.app.vault.getAbstractFileByPath(action.filePath);
                    if (file instanceof TFile) {
                        await this.app.vault.process(file, (content: string) => {
                            const lines = content.split("\n");
                            if (lines[action.line!]) {
                                const parsed = parseLine(lines[action.line!]!, this.settings.syncTag);
                                lines[action.line!] = buildTaskLine({
                                    checked: parsed?.checked ?? false,
                                    title: action.thingsTask!.title,
                                    uuid: action.uuid!,
                                    tag: this.settings.syncTag,
                                });
                            }
                            return lines.join("\n");
                        });
                    }
                }
                break;
            }
        }
    }

    async updateTaskMetadata(uuid: string, changes: TaskMetadataChanges) {
        this.log(`Updating metadata for task ${uuid}`);

        // Push changes to Things via AppleScript
        const cached = this.taskCache.find((t) => t.uuid === uuid);
        const oldNotes = cached?.notes ?? "";
        const oldStartDate = cached?.startDate ?? null;
        const oldDeadline = cached?.deadline ?? null;

        if (changes.notes !== oldNotes) {
            await updateTaskNotes(uuid, changes.notes);
        }
        if (changes.startDate !== oldStartDate) {
            await updateTaskStartDate(uuid, changes.startDate);
        }
        if (changes.deadline !== oldDeadline) {
            await updateTaskDeadline(uuid, changes.deadline);
        }

        // Update local cache optimistically
        if (cached) {
            cached.notes = changes.notes;
            cached.startDate = changes.startDate;
            cached.deadline = changes.deadline;
        }

        this.dispatchCacheToEditors();
        new Notice("Task updated in Things");
    }

    dispatchCacheToEditors() {
        const cacheState = buildCacheState(this.taskCache, this.settings);
        this.taskCacheMap = cacheState.tasks;
        this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
            // @ts-expect-error -- MarkdownView exposes .editor?.cm
            const cm = leaf.view?.editor?.cm as import("@codemirror/view").EditorView | undefined;
            if (cm) {
                cm.dispatch({ effects: updateTaskCache.of(cacheState) });
            }
        });
    }

    log(message: string) {
        if (this.settings.debugLogging) {
            console.log(`[Things Sync] ${message}`);
        }
    }

    async loadSettings() {
        const data = await this.loadData();
        if (data) {
            const { syncState: _syncState, ...settingsData } = data;
            this.settings = Object.assign({}, DEFAULT_SETTINGS, settingsData);
        }
    }

    async saveSettings() {
        await this.persistState();
        this.dispatchCacheToEditors();
    }

    private async persistState() {
        await this.saveData({
            ...this.settings,
            syncState: this.syncState,
        });
    }
}
