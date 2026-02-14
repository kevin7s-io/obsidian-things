import { Notice, Platform, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { ThingsSyncSettings, DEFAULT_SETTINGS, ThingsTask, ThingsStatus, ThingsItemType, ThingsStart, SyncState, ScannedTask } from "./types";
import { readAllTasks, ThingsNotRunningError } from "./things-reader";
import { createTask, completeTask, reopenTask, deleteTask, updateTaskTitle, updateTaskNotes, updateTaskTags, updateTaskDates, launchThingsInBackground } from "./things-writer";
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
    private syncIntervalId: number | null = null;
    private tagSyncDebounceId: number | null = null;
    private codeBlocks: Array<{ el: HTMLElement; source: string }> = [];

    async onload() {
        await this.loadSettings();

        if (!Platform.isMacOS || !Platform.isDesktopApp) {
            new Notice("Things Sync requires macOS desktop.");
            return;
        }

        // Load persisted state (sync state + cached tasks from last session)
        const savedData = await this.loadData();
        if (savedData?.syncState) {
            this.syncState = savedData.syncState;
        }
        if (savedData?.cachedTasks?.length) {
            this.taskCache = savedData.cachedTasks;
            this.log(`Loaded ${this.taskCache.length} cached tasks from last session`);
        }

        // Register code block processor
        this.registerMarkdownCodeBlockProcessor("things", (source, el) => {
            this.codeBlocks = this.codeBlocks.filter((ref) => ref.el.isConnected);
            this.codeBlocks.push({ el, source });
            this.renderCodeBlock(source, el);
        });

        // Edit handler — opens modal, pushes changes to Things
        const openEditModal = (uuid: string, task: ThingsTask) => {
            new TaskEditModal(
                this.app,
                task,
                (u, changes) => this.updateTaskMetadata(u, changes),
                (u) => this.deleteTaskAndCleanup(u)
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

        // Trigger sync when an unlinked #things tag is detected
        this.registerEvent(
            this.app.vault.on("modify", (file) => {
                if (file instanceof TFile && file.extension === "md") {
                    this.checkForUnlinkedTags(file);
                }
            })
        );

        // Add command for manual sync
        this.addCommand({
            id: "sync-now",
            name: "Sync with Things 3",
            callback: () => this.runSync(true),
        });

        // Register sync interval
        this.resetSyncInterval();

        // Settings tab
        this.addSettingTab(new ThingsSyncSettingTab(this.app, this));

        // Dispatch persisted cache immediately so content renders before first sync
        if (this.taskCache.length > 0) {
            this.dispatchCacheToEditors();
        }

        // Launch Things in background if configured
        if (this.settings.launchThingsOnStartup) {
            launchThingsInBackground();
        }

        // Initial sync
        if (this.settings.syncOnStartup) {
            // Delay slightly to let vault finish loading (and Things to launch)
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

            // Step 4b: Update scanned data to reflect mutations from actions
            for (const action of actions) {
                switch (action.type) {
                    case "complete-in-obsidian": {
                        if (!action.uuid) break;
                        const scanned = scannedTasks.find(s => s.uuid === action.uuid);
                        if (scanned) scanned.checked = true;
                        break;
                    }
                    case "reopen-in-obsidian": {
                        if (!action.uuid) break;
                        const scanned = scannedTasks.find(s => s.uuid === action.uuid);
                        if (scanned) scanned.checked = false;
                        break;
                    }
                    case "create-in-things": {
                        // After creating a task in Things, the UUID was assigned in applyAction.
                        // Find the scanned task by filePath+line and set its uuid so sync state records it.
                        if (action.filePath !== undefined && action.line !== undefined) {
                            const scanned = scannedTasks.find(
                                s => s.filePath === action.filePath && s.line === action.line
                            );
                            if (scanned && !scanned.uuid) {
                                // The uuid was written to syncState in applyAction; retrieve it
                                const entry = Object.values(this.syncState.tasks).find(
                                    t => t.filePath === action.filePath && t.line === action.line
                                );
                                if (entry) scanned.uuid = entry.uuid;
                            }
                        }
                        break;
                    }
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
                            // Verify line contains expected task content before modifying
                            if (!lines[action.line!]?.includes(action.scannedTask!.title)) {
                                return content; // return unchanged
                            }
                            lines[action.line!] = buildTaskLine({
                                checked: action.scannedTask!.checked,
                                title: action.scannedTask!.title,
                                uuid,
                                tag: this.settings.syncTag,
                            });
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

                    // Push synthetic task so card renders immediately
                    this.taskCache.push({
                        uuid,
                        title: action.title!,
                        status: ThingsStatus.Open,
                        type: ThingsItemType.Todo,
                        notes: "",
                        project: null,
                        projectTitle: null,
                        area: null,
                        areaTitle: null,
                        tags: [],
                        startDate: null,
                        deadline: null,
                        stopDate: null,
                        creationDate: Date.now() / 1000,
                        userModificationDate: Date.now() / 1000,
                        start: ThingsStart.Inbox,
                        inTodayList: false,
                        trashed: false,
                    });
                    this.dispatchCacheToEditors();
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
                            // Verify line contains expected UUID before modifying
                            if (action.uuid && !lines[action.line!]?.includes(action.uuid)) {
                                return content; // return unchanged
                            }
                            lines[action.line!] = buildTaskLine({
                                checked,
                                title: action.thingsTask!.title,
                                uuid: action.uuid!,
                                tag: this.settings.syncTag,
                            });
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
                            // Verify line contains expected UUID before modifying
                            if (action.uuid && !lines[action.line!]?.includes(action.uuid)) {
                                return content; // return unchanged
                            }
                            const parsed = parseLine(lines[action.line!]!, this.settings.syncTag);
                            lines[action.line!] = buildTaskLine({
                                checked: parsed?.checked ?? false,
                                title: action.thingsTask!.title,
                                uuid: action.uuid!,
                                tag: this.settings.syncTag,
                            });
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

        const cached = this.taskCache.find((t) => t.uuid === uuid);
        const oldTitle = cached?.title ?? "";
        const oldNotes = cached?.notes ?? "";
        const oldStartDate = cached?.startDate ?? null;
        const oldDeadline = cached?.deadline ?? null;

        // Push all changes to Things first; only update cache if all succeed
        // Push title via AppleScript (silent, no auth needed)
        if (changes.title !== oldTitle) {
            await updateTaskTitle(uuid, changes.title);
        }

        // Push notes via AppleScript (silent, no auth needed)
        if (changes.notes !== oldNotes) {
            await updateTaskNotes(uuid, changes.notes);
        }

        // Push tags via AppleScript (silent, no auth needed)
        const oldTags = cached?.tags ?? [];
        const tagsChanged = changes.tags.join(",") !== oldTags.join(",");
        if (tagsChanged) {
            await updateTaskTags(uuid, changes.tags);
        }

        // Push dates via Things URL scheme (requires auth token)
        const datesChanged = changes.startDate !== oldStartDate || changes.deadline !== oldDeadline;
        if (datesChanged) {
            await updateTaskDates(
                this.settings.thingsAuthToken,
                uuid,
                changes.startDate,
                changes.deadline
            );
        }

        // All writes succeeded — now update local cache
        if (cached) {
            cached.title = changes.title;
            cached.notes = changes.notes;
            cached.tags = changes.tags;
            cached.startDate = changes.startDate;
            cached.deadline = changes.deadline;
        }

        new Notice("Task updated in Things");

        // Refresh display immediately with updated data
        this.dispatchCacheToEditors();

        // Then sync to confirm changes landed
        await this.runSync();
    }

    async deleteTaskAndCleanup(uuid: string) {
        this.log(`Deleting task ${uuid}`);
        await deleteTask(uuid);

        // Remove from local cache
        this.taskCache = this.taskCache.filter((t) => t.uuid !== uuid);
        delete this.syncState.tasks[uuid];

        // Remove the line from the vault file
        const tracked = Object.values(this.syncState.tasks).find((t) => t.uuid === uuid);
        // We already deleted from syncState, so search all markdown files
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            const content = await this.app.vault.cachedRead(file);
            if (!content.includes(`<!-- things:${uuid} -->`)) continue;
            await this.app.vault.process(file, (c: string) => {
                const lines = c.split("\n");
                const filtered = lines.filter((l) => !l.includes(`<!-- things:${uuid} -->`));
                return filtered.join("\n");
            });
            break;
        }

        await this.persistState();
        this.dispatchCacheToEditors();
        new Notice("Task deleted from Things");
    }

    private resetSyncInterval() {
        if (this.syncIntervalId !== null) {
            window.clearInterval(this.syncIntervalId);
        }
        this.syncIntervalId = window.setInterval(
            () => this.runSync(),
            this.settings.syncIntervalSeconds * 1000
        );
        this.registerInterval(this.syncIntervalId);
    }

    private renderCodeBlock(source: string, el: HTMLElement) {
        el.empty();
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
                    const cached = this.taskCache.find((t) => t.uuid === uuid);
                    if (cached) {
                        cached.status = completed ? ThingsStatus.Completed : ThingsStatus.Open;
                    }
                    this.refreshCodeBlocks();
                } catch (err) {
                    new Notice(`Things Sync: Failed to update task — ${err}`);
                }
            },
        };

        if (query.view === "kanban") {
            renderKanbanView(el, tasks, query, handler, this.settings);
        } else {
            renderListView(el, tasks, query, handler, this.settings);
        }
    }

    private refreshCodeBlocks() {
        // Prune detached elements
        this.codeBlocks = this.codeBlocks.filter((ref) => ref.el.isConnected);
        for (const ref of this.codeBlocks) {
            this.renderCodeBlock(ref.source, ref.el);
        }
    }

    dispatchCacheToEditors() {
        const cacheState = buildCacheState(this.taskCache, this.settings);
        this.taskCacheMap = cacheState.tasks;
        this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
            try {
                // @ts-expect-error -- MarkdownView exposes .editor?.cm
                const cm = leaf.view?.editor?.cm as import("@codemirror/view").EditorView | undefined;
                if (cm) {
                    cm.dispatch({ effects: updateTaskCache.of(cacheState) });
                }
            } catch {
                // Ignore leaves where CM access fails
            }
        });
        this.refreshCodeBlocks();
    }

    private async checkForUnlinkedTags(file: TFile) {
        const content = await this.app.vault.cachedRead(file);
        const escapedTag = this.settings.syncTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(
            `^- \\[[ x]\\] .+${escapedTag}(?:\\s|$)(?!.*<!--\\s*things:)`,
            "m"
        );
        if (!pattern.test(content)) return;

        if (this.tagSyncDebounceId !== null) {
            window.clearTimeout(this.tagSyncDebounceId);
        }
        this.tagSyncDebounceId = window.setTimeout(() => {
            this.tagSyncDebounceId = null;
            this.runSync();
        }, 1500);
    }

    log(message: string) {
        if (this.settings.debugLogging) {
            console.log(`[Things Sync] ${message}`);
        }
    }

    async loadSettings() {
        const data = await this.loadData();
        if (data) {
            const { syncState: _syncState, cachedTasks: _cachedTasks, ...settingsData } = data;
            this.settings = Object.assign({}, DEFAULT_SETTINGS, settingsData);
        }
    }

    async saveSettings() {
        await this.persistState();
        this.resetSyncInterval();
        this.dispatchCacheToEditors();
    }

    private async persistState() {
        await this.saveData({
            ...this.settings,
            syncState: this.syncState,
            cachedTasks: this.taskCache,
        });
    }
}
