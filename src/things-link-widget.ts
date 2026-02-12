import { App, MarkdownPostProcessorContext, MarkdownRenderChild, editorLivePreviewField } from "obsidian";
import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, WidgetType, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { taskCacheField, TaskCacheState } from "./task-cache-state";
import type { ThingsTask, ThingsStatus } from "./types";

// --- Shared helpers ---

const THINGS_LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16"><rect x=".5" y=".5" width="15" height="15" rx="3.5" fill="#4A89DC"/><rect x="3" y="3" width="10" height="10" rx="1.5" fill="#fff"/><path d="M5.2 8.4l2 2.1 3.8-4.2" fill="none" stroke="#4A89DC" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Calendar icon for scheduled/start date (matches Things' orange calendar)
const CALENDAR_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 14 14"><rect x="1.5" y="3" width="11" height="9.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="1.5" y1="6" x2="12.5" y2="6" stroke="currentColor" stroke-width="1.3"/><line x1="4.5" y1="3" x2="4.5" y2="1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="9.5" y1="3" x2="9.5" y2="1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';

// Flag icon for deadline (matches Things' flag)
const FLAG_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 14 14"><path d="M3 13V1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M3 2h8l-2.5 2.75L11 7.5H3z" fill="currentColor" opacity="0.25" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>';

// Rounded-square checkbox SVGs for card view (matches Things 3 style)
const CHECKBOX_OPEN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 13 13"><rect x="0.75" y="0.75" width="11.5" height="11.5" rx="2.8" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.4"/></svg>';
const CHECKBOX_DONE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 13 13"><rect x="0.75" y="0.75" width="11.5" height="11.5" rx="2.8" fill="#4A89DC"/><path d="M4 7l1.8 1.8 3.2-3.6" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Project/folder icon for card footer
const PROJECT_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 14 14"><path d="M1.5 3.5v7a1 1 0 001 1h9a1 1 0 001-1v-5.5a1 1 0 00-1-1H7L5.5 2.5h-3a1 1 0 00-1 1z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';

// Pencil icon for card edit button
const EDIT_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><path d="M2.5 11.5l-.5 2 2-.5 7.8-7.8-1.5-1.5z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M8.8 3.7l1.5 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';

// Module-level edit handler — set by main.ts, used by ViewPlugin widgets
let editTaskHandler: ((uuid: string, task: ThingsTask) => void) | null = null;

export function setEditTaskHandler(handler: (uuid: string, task: ThingsTask) => void): void {
    editTaskHandler = handler;
}

// Tag color palette — 8 muted colors for consistent tag coloring
const TAG_PALETTE = [
    "#5B8DEF", "#E06C75", "#E5C07B", "#56B6C2",
    "#C678DD", "#98C379", "#D19A66", "#61AFEF",
];

function tagColor(tag: string): string {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash += tag.charCodeAt(i);
    return TAG_PALETTE[hash % TAG_PALETTE.length]!;
}

function formatRelativeDate(iso: string): string {
    const [year, month, day] = iso.split("-").map(Number);
    const target = new Date(year!, month! - 1, day);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays > 1 && diffDays <= 6) {
        return target.toLocaleDateString("en-US", { weekday: "long" });
    }
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthStr = months[month! - 1] ?? "???";
    if (year === now.getFullYear()) return `${monthStr} ${day}`;
    return `${monthStr} ${day}, ${year}`;
}

function formatDeadlineCountdown(iso: string): { text: string; overdue: boolean } {
    const [year, month, day] = iso.split("-").map(Number);
    const target = new Date(year!, month! - 1, day);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

    if (diffDays < 0) return { text: "Overdue", overdue: true };
    if (diffDays === 0) return { text: "Today", overdue: false };
    if (diffDays === 1) return { text: "Tomorrow", overdue: false };
    if (diffDays <= 14) return { text: `${diffDays} days left`, overdue: false };
    return { text: formatRelativeDate(iso), overdue: false };
}

interface CardSettings extends BadgeSettings {
    displayMode: "inline" | "card";
    syncTag: string;
}

function createThingsLogoLink(uuid: string): HTMLElement {
    const cleanUuid = uuid.replace(/^to do id /, "").replace(/%/g, "").trim();
    const link = document.createElement("span");
    link.className = "things-card-link";
    link.setAttribute("aria-label", `Open in Things: ${cleanUuid}`);
    link.setAttribute("data-tooltip-position", "top");
    link.innerHTML = THINGS_LOGO_SVG;
    link.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(`things:///show?id=${cleanUuid}`);
    });
    return link;
}

function buildCardDOM(
    task: ThingsTask,
    uuid: string,
    settings: CardSettings,
    readingView: boolean,
    checked?: boolean,
    onCheckboxToggle?: () => void,
    onEdit?: () => void
): HTMLElement {
    const card = document.createElement("div");
    card.className = "things-card";

    // Main row: checkbox + content + link icon
    const main = document.createElement("div");
    main.className = "things-card-main";

    // Checkbox — reflect markdown [x]/[ ] state, fall back to task status
    const checkbox = document.createElement("div");
    checkbox.className = "things-card-checkbox";
    const isCompleted = checked ?? task.status === (3 as ThingsStatus);
    checkbox.innerHTML = isCompleted ? CHECKBOX_DONE_SVG : CHECKBOX_OPEN_SVG;
    if (!readingView && onCheckboxToggle) {
        checkbox.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onCheckboxToggle();
        });
    }
    main.appendChild(checkbox);

    // Content: title + notes
    const content = document.createElement("div");
    content.className = "things-card-content";

    const title = document.createElement("div");
    title.className = "things-card-title";
    title.textContent = task.title;
    content.appendChild(title);

    if (task.notes?.trim()) {
        const notes = document.createElement("div");
        notes.className = "things-card-notes";
        notes.textContent = task.notes;
        content.appendChild(notes);
    }
    // Footer: vertical stack — tags row, start date row, deadline row (with edit button)
    // Lives inside content div so it aligns with title/notes
    const footer = document.createElement("div");
    footer.className = "things-card-footer";
    let hasFooter = false;

    // Tags row
    if (settings.showTags && task.tags.length > 0) {
        const tagRow = document.createElement("div");
        tagRow.className = "things-card-row";
        for (const tag of task.tags) {
            const pill = document.createElement("span");
            pill.className = "things-card-tag";
            pill.style.background = tagColor(tag);
            pill.textContent = tag;
            tagRow.appendChild(pill);
        }
        footer.appendChild(tagRow);
        hasFooter = true;
    }

    // Start date row
    if (settings.showStartDate && task.startDate) {
        const row = document.createElement("div");
        row.className = "things-card-row things-card-date things-card-scheduled";
        row.innerHTML = CALENDAR_ICON_SVG + " ";
        row.appendChild(document.createTextNode(formatRelativeDate(task.startDate)));
        footer.appendChild(row);
        hasFooter = true;
    }

    // Area row
    if (settings.showArea && task.areaTitle) {
        const row = document.createElement("div");
        row.className = "things-card-row things-card-area";
        row.textContent = task.areaTitle;
        footer.appendChild(row);
        hasFooter = true;
    }

    // Project row
    if (settings.showProject && task.projectTitle) {
        const row = document.createElement("div");
        row.className = "things-card-row things-card-project";
        row.innerHTML = PROJECT_ICON_SVG + " ";
        row.appendChild(document.createTextNode(task.projectTitle));
        footer.appendChild(row);
        hasFooter = true;
    }

    // Deadline row
    if (settings.showDeadline && task.deadline) {
        const countdown = formatDeadlineCountdown(task.deadline);
        const row = document.createElement("div");
        row.className = "things-card-row things-card-date things-card-deadline";
        if (countdown.overdue) row.classList.add("things-card-deadline-overdue");
        row.innerHTML = FLAG_ICON_SVG + " ";
        const dateText = formatRelativeDate(task.deadline);
        row.appendChild(document.createTextNode("Deadline: " + dateText));
        if (countdown.text !== dateText) {
            const countdownSpan = document.createElement("span");
            countdownSpan.className = "things-card-countdown";
            countdownSpan.textContent = countdown.text;
            row.appendChild(document.createTextNode("  "));
            row.appendChild(countdownSpan);
        }
        footer.appendChild(row);
        hasFooter = true;
    }

    if (hasFooter) {
        content.appendChild(footer);
    }

    main.appendChild(content);

    // Things logo link (top-right)
    main.appendChild(createThingsLogoLink(uuid));

    card.appendChild(main);

    // Edit button — absolutely positioned at bottom-right of card
    if (onEdit) {
        const editBtn = document.createElement("span");
        editBtn.className = "things-card-edit";
        editBtn.setAttribute("aria-label", "Edit task");
        editBtn.innerHTML = EDIT_ICON_SVG;
        editBtn.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
        });
        card.appendChild(editBtn);
    }

    return card;
}

function createThingsLogo(): HTMLElement {
    const span = document.createElement("span");
    span.className = "things-logo";
    span.setAttribute("aria-label", "Linked to Things");
    span.innerHTML = THINGS_LOGO_SVG;
    return span;
}

function createThingsIcon(uuid: string): HTMLElement {
    const cleanUuid = uuid.replace(/^to do id /, "").replace(/%/g, "").trim();
    const icon = document.createElement("span");
    icon.className = "things-link-icon";
    icon.setAttribute("aria-label", `Open in Things: ${cleanUuid}`);
    icon.setAttribute("data-tooltip-position", "top");
    icon.textContent = "\u{1F517}";
    icon.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(`things:///show?id=${cleanUuid}`);
    });
    return icon;
}

function formatDate(iso: string): string {
    const [year, month, day] = iso.split("-").map(Number);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthStr = months[month! - 1] ?? "???";
    const now = new Date();
    if (year === now.getFullYear()) {
        return `${monthStr} ${day}`;
    }
    return `${monthStr} ${day}, ${year}`;
}

interface BadgeSettings {
    showProject: boolean;
    showDeadline: boolean;
    showArea: boolean;
    showStartDate: boolean;
    showTags: boolean;
}

function createMetadataBadges(task: ThingsTask, settings: BadgeSettings, readingView: boolean): DocumentFragment {
    const frag = document.createDocumentFragment();
    const container = document.createElement("span");
    container.className = "things-inline-meta";

    // Tags first — rendered as Obsidian-style #tag elements
    if (settings.showTags && task.tags.length > 0) {
        for (const tag of task.tags) {
            if (readingView) {
                const a = document.createElement("a");
                a.className = "tag things-badge things-badge-tag";
                a.href = `#${tag}`;
                a.target = "_blank";
                a.rel = "noopener";
                a.textContent = `#${tag}`;
                container.appendChild(a);
            } else {
                const span = document.createElement("span");
                span.className = "things-badge things-badge-tag";
                span.textContent = `#${tag}`;
                container.appendChild(span);
            }
        }
    }

    // Start date (calendar icon)
    if (settings.showStartDate && task.startDate) {
        const badge = document.createElement("span");
        badge.className = "things-badge things-badge-start";
        const icon = document.createElement("span");
        icon.className = "things-date-icon";
        icon.innerHTML = CALENDAR_ICON_SVG;
        badge.appendChild(icon);
        badge.appendChild(document.createTextNode(` ${formatDate(task.startDate)}`));
        container.appendChild(badge);
    }

    // Deadline (flag icon)
    if (settings.showDeadline && task.deadline) {
        const badge = document.createElement("span");
        badge.className = "things-badge things-badge-deadline";
        const icon = document.createElement("span");
        icon.className = "things-date-icon";
        icon.innerHTML = FLAG_ICON_SVG;
        badge.appendChild(icon);
        badge.appendChild(document.createTextNode(` ${formatDate(task.deadline)}`));
        container.appendChild(badge);
    }

    // Project
    if (settings.showProject && task.projectTitle) {
        const badge = document.createElement("span");
        badge.className = "things-badge things-badge-project";
        badge.textContent = task.projectTitle;
        container.appendChild(badge);
    }

    // Area
    if (settings.showArea && task.areaTitle) {
        const badge = document.createElement("span");
        badge.className = "things-badge things-badge-area";
        badge.textContent = task.areaTitle;
        container.appendChild(badge);
    }

    if (container.childNodes.length > 0) {
        frag.appendChild(container);
    }
    return frag;
}

// --- Live preview widgets ---

class ThingsLogoWidget extends WidgetType {
    eq() { return true; }
    toDOM() { return createThingsLogo(); }
}

class ThingsMetadataWidget extends WidgetType {
    constructor(
        readonly uuid: string,
        readonly task: ThingsTask | undefined,
        readonly cacheState: TaskCacheState
    ) {
        super();
    }

    eq(other: ThingsMetadataWidget): boolean {
        return this.uuid === other.uuid &&
            this.task === other.task &&
            this.cacheState === other.cacheState;
    }

    toDOM(): HTMLElement {
        const wrapper = document.createElement("span");
        // Metadata badges first (tags, dates, project, area)
        if (this.task) {
            wrapper.appendChild(createMetadataBadges(this.task, this.cacheState, false));
        }
        // Link icon always last
        wrapper.appendChild(createThingsIcon(this.uuid));
        return wrapper;
    }
}

class ThingsCardWidget extends WidgetType {
    constructor(
        readonly uuid: string,
        readonly task: ThingsTask | undefined,
        readonly cacheState: TaskCacheState,
        readonly lineText: string
    ) {
        super();
    }

    eq(other: ThingsCardWidget): boolean {
        return this.uuid === other.uuid &&
            this.task === other.task &&
            this.cacheState === other.cacheState &&
            this.lineText === other.lineText;
    }

    get estimatedHeight(): number {
        return 80;
    }

    toDOM(view: EditorView): HTMLElement {
        if (!this.task) {
            const placeholder = document.createElement("div");
            placeholder.className = "things-card";
            placeholder.textContent = "Loading\u2026";
            return placeholder;
        }

        const isChecked = /- \[x\] /i.test(this.lineText);

        const onCheckboxToggle = () => {
            // Find the line containing this UUID
            const doc = view.state.doc;
            const uuidPattern = `%%things:${this.uuid}%%`;
            for (let i = 1; i <= doc.lines; i++) {
                const line = doc.line(i);
                if (!line.text.includes(uuidPattern)) continue;
                const checkPos = line.text.indexOf(isChecked ? "[x]" : "[ ]");
                if (checkPos === -1) continue;
                const from = line.from + checkPos + 1;
                const to = from + 1;
                view.dispatch({
                    changes: { from, to, insert: isChecked ? " " : "x" },
                });
                break;
            }
        };

        const onEdit = editTaskHandler && this.task
            ? () => editTaskHandler!(this.uuid, this.task!)
            : undefined;

        return buildCardDOM(this.task, this.uuid, this.cacheState, false, isChecked, onCheckboxToggle, onEdit);
    }
}

// --- Live preview: ViewPlugin ---

export const thingsLinkViewPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
            this.decorations = this.build(view);
        }
        update(update: ViewUpdate) {
            if (
                update.docChanged ||
                update.selectionSet ||
                update.state.field(taskCacheField) !== update.startState.field(taskCacheField)
            ) {
                this.decorations = this.build(update.view);
            }
        }
        build(view: EditorView): DecorationSet {
            try {
                return this._build(view);
            } catch (err) {
                console.error("[Things Sync] ViewPlugin build error:", err);
                return Decoration.none;
            }
        }
        _build(view: EditorView): DecorationSet {
            if (!view.state.field(editorLivePreviewField)) {
                return Decoration.none;
            }
            const cacheState = view.state.field(taskCacheField);
            const builder = new RangeSetBuilder<Decoration>();
            const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
            const uuidRegex = /%%things:([^%]+)%%/g;

            if (cacheState.displayMode === "card") {
                // Card mode: replace entire line with ThingsCardWidget
                for (let i = 1; i <= view.state.doc.lines; i++) {
                    if (i === cursorLine) continue;
                    const line = view.state.doc.line(i);
                    uuidRegex.lastIndex = 0;
                    const uuidMatch = uuidRegex.exec(line.text);
                    if (!uuidMatch) continue;
                    const uuid = uuidMatch[1]!.replace(/^to do id /, "");
                    const task = cacheState.tasks.get(uuid);
                    builder.add(
                        line.from,
                        line.to,
                        Decoration.replace({
                            widget: new ThingsCardWidget(uuid, task, cacheState, line.text),
                        })
                    );
                }
            } else {
                // Inline mode: existing decoration logic
                const syncTag = cacheState.syncTag;
                const escapedTag = syncTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const tagRegex = new RegExp(`${escapedTag}(?=\\s|$)`);

                for (let i = 1; i <= view.state.doc.lines; i++) {
                    if (i === cursorLine) continue;
                    const line = view.state.doc.line(i);

                    uuidRegex.lastIndex = 0;
                    const uuidMatch = uuidRegex.exec(line.text);
                    if (!uuidMatch) continue;

                    const uuid = uuidMatch[1]!.replace(/^to do id /, "");
                    const task = cacheState.tasks.get(uuid);
                    const isCheckbox = /^- \[[ x]\] /.test(line.text);

                    // Decorations must be added in ascending position order.
                    // 0. Override Obsidian's %% comment styling on the task text.
                    const contentEnd = uuidMatch.index;
                    builder.add(
                        line.from,
                        line.from + contentEnd,
                        Decoration.mark({ class: "things-task-line" })
                    );

                    // 1. Things logo after checkbox (earliest position)
                    if (isCheckbox) {
                        builder.add(
                            line.from + 6,
                            line.from + 6,
                            Decoration.widget({ widget: new ThingsLogoWidget(), side: -1 })
                        );
                    }

                    // 2. Hide the sync tag (middle of line)
                    const tagMatch = tagRegex.exec(line.text);
                    if (tagMatch) {
                        const tagStart = tagMatch.index;
                        let tagEnd = tagStart + syncTag.length;
                        while (tagEnd < line.text.length && line.text[tagEnd] === " ") tagEnd++;
                        builder.add(
                            line.from + tagStart,
                            line.from + tagEnd,
                            Decoration.replace({})
                        );
                    }

                    // 3. Replace UUID comment with metadata widget — link icon last
                    builder.add(
                        line.from + uuidMatch.index,
                        line.from + uuidMatch.index + uuidMatch[0].length,
                        Decoration.replace({
                            widget: new ThingsMetadataWidget(uuid, task, cacheState),
                        })
                    );
                }
            }
            return builder.finish();
        }
    },
    { decorations: (v) => v.decorations }
);

// --- Reading view: PostProcessor ---

class ThingsLinkChild extends MarkdownRenderChild {
    constructor(
        containerEl: HTMLElement,
        private listItems: NodeListOf<Element>,
        private ctx: MarkdownPostProcessorContext,
        private app: App,
        private getTaskCache: () => Map<string, ThingsTask>,
        private getSettings: () => CardSettings,
        private onEditTask?: (uuid: string, task: ThingsTask) => void
    ) {
        super(containerEl);
    }

    onload() {
        const section = this.ctx.getSectionInfo(this.containerEl);
        if (!section) return;

        const sourceLines = section.text.split("\n").slice(section.lineStart, section.lineEnd + 1);
        const taskCache = this.getTaskCache();
        const settings = this.getSettings();
        let liIndex = 0;
        for (const line of sourceLines) {
            if (!/^- \[[ x]\]/.test(line)) continue;
            const uuidMatch = line.match(/%%things:([^%]+)%%/);
            if (uuidMatch && liIndex < this.listItems.length) {
                const uuid = uuidMatch[1]!.replace(/^to do id /, "");
                const li = this.listItems[liIndex]! as HTMLElement;
                const task = taskCache.get(uuid);

                if (settings.displayMode === "card" && task) {
                    // Card mode: replace li content with card DOM
                    const isChecked = /- \[x\]/.test(line);
                    const onEdit = this.onEditTask
                        ? () => this.onEditTask!(uuid, task)
                        : undefined;
                    li.empty();
                    li.appendChild(buildCardDOM(task, uuid, settings, true, isChecked, undefined, onEdit));
                    li.classList.add("things-card-li");
                } else {
                    // Inline mode: existing logic
                    const tagEls = li.querySelectorAll("a.tag");
                    for (const tagEl of Array.from(tagEls)) {
                        if (tagEl.textContent === settings.syncTag) {
                            (tagEl as HTMLElement).style.display = "none";
                        }
                    }

                    const checkbox = li.querySelector(".task-list-item-checkbox");
                    if (checkbox) {
                        checkbox.insertAdjacentElement("afterend", createThingsLogo());
                    } else {
                        li.prepend(createThingsLogo());
                    }

                    if (task) {
                        li.appendChild(createMetadataBadges(task, settings, true));
                    }

                    li.appendChild(createThingsIcon(uuid));
                }
            }
            liIndex++;
        }
    }
}

export function createThingsPostProcessor(
    app: App,
    getTaskCache: () => Map<string, ThingsTask>,
    getSettings: () => CardSettings,
    onEditTask?: (uuid: string, task: ThingsTask) => void
) {
    return (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
        const listItems = el.querySelectorAll("li");
        if (listItems.length === 0) return;
        ctx.addChild(new ThingsLinkChild(el, listItems, ctx, app, getTaskCache, getSettings, onEditTask));
    };
}
