import { App, Modal, Setting } from "obsidian";
import type { ThingsTask } from "./types";

export interface TaskMetadataChanges {
    notes: string;
    tags: string[];
    startDate: string | null;
    deadline: string | null;
}

export class TaskEditModal extends Modal {
    private notes: string;
    private tags: string;
    private startDate: string;
    private deadline: string;
    private saved = false;

    constructor(
        app: App,
        private task: ThingsTask,
        private onSave: (uuid: string, changes: TaskMetadataChanges) => Promise<void>
    ) {
        super(app);
        this.notes = task.notes ?? "";
        this.tags = (task.tags ?? []).join(", ");
        this.startDate = task.startDate ?? "";
        this.deadline = task.deadline ?? "";
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("things-edit-modal");

        // Center modal over the editor pane, not the full window
        const leftSplit = this.app.workspace.containerEl.querySelector(
            ".workspace-split.mod-left-split"
        ) as HTMLElement | null;
        if (leftSplit) {
            const sidebarWidth = leftSplit.getBoundingClientRect().width;
            this.modalEl.style.marginLeft = `${sidebarWidth}px`;
        }

        contentEl.createEl("h3", { text: this.task.title });

        // Notes
        new Setting(contentEl)
            .setName("Notes")
            .setClass("things-edit-notes-setting")
            .addTextArea((text) => {
                text.setValue(this.notes)
                    .setPlaceholder("Task notes...")
                    .onChange((value) => {
                        this.notes = value;
                    });
                text.inputEl.rows = 6;
                text.inputEl.addClass("things-edit-notes");
            });

        // Tags
        new Setting(contentEl)
            .setName("Tags")
            .setDesc("Comma-separated tag names")
            .addText((text) => {
                text.setValue(this.tags)
                    .setPlaceholder("tag1, tag2")
                    .onChange((value) => {
                        this.tags = value;
                    });
                text.inputEl.addClass("things-edit-tags");
            });

        // Scheduled date
        const startSetting = new Setting(contentEl).setName("Scheduled");
        const startInput = document.createElement("input");
        startInput.type = "date";
        startInput.className = "things-edit-date";
        startInput.value = this.startDate;
        startInput.addEventListener("change", () => {
            this.startDate = startInput.value;
        });
        startSetting.controlEl.appendChild(startInput);
        if (this.startDate) {
            startSetting.addExtraButton((btn) =>
                btn.setIcon("x").setTooltip("Clear").onClick(() => {
                    this.startDate = "";
                    startInput.value = "";
                })
            );
        }

        // Deadline
        const deadlineSetting = new Setting(contentEl).setName("Deadline");
        const deadlineInput = document.createElement("input");
        deadlineInput.type = "date";
        deadlineInput.className = "things-edit-date";
        deadlineInput.value = this.deadline;
        deadlineInput.addEventListener("change", () => {
            this.deadline = deadlineInput.value;
        });
        deadlineSetting.controlEl.appendChild(deadlineInput);
        if (this.deadline) {
            deadlineSetting.addExtraButton((btn) =>
                btn.setIcon("x").setTooltip("Clear").onClick(() => {
                    this.deadline = "";
                    deadlineInput.value = "";
                })
            );
        }

        // Buttons
        const buttonRow = contentEl.createDiv({ cls: "things-edit-buttons" });

        const cancelBtn = buttonRow.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => this.close());

        const saveBtn = buttonRow.createEl("button", {
            text: "Save",
            cls: "mod-cta",
        });
        saveBtn.addEventListener("click", async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = "Saving\u2026";
            try {
                const parsedTags = this.tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0);
                await this.onSave(this.task.uuid, {
                    notes: this.notes,
                    tags: parsedTags,
                    startDate: this.startDate || null,
                    deadline: this.deadline || null,
                });
                this.saved = true;
                this.close();
            } catch (err) {
                saveBtn.disabled = false;
                saveBtn.textContent = "Save";
                const errEl = contentEl.querySelector(".things-edit-error");
                if (errEl) errEl.remove();
                contentEl.createEl("div", {
                    text: `Error: ${err}`,
                    cls: "things-edit-error",
                });
            }
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}
