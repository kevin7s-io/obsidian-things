import { App, MarkdownPostProcessorContext, MarkdownRenderChild, editorLivePreviewField } from "obsidian";
import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, WidgetType, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { taskCacheField, TaskCacheState } from "./task-cache-state";
import type { ThingsTask } from "./types";

// --- Shared helpers ---

const THINGS_LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="3" fill="#4A89DC"/><path d="M8 4.5v7M4.5 8h7M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/></svg>';

function createThingsLogo(): HTMLElement {
    const span = document.createElement("span");
    span.className = "things-logo";
    span.setAttribute("aria-label", "Linked to Things");
    span.innerHTML = THINGS_LOGO_SVG;
    return span;
}

function createThingsIcon(uuid: string): HTMLElement {
    const cleanUuid = uuid.replace(/^to do id /, "");
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

    // Start date
    if (settings.showStartDate && task.startDate) {
        const badge = document.createElement("span");
        badge.className = "things-badge things-badge-start";
        badge.textContent = `\u{1F4C6} ${formatDate(task.startDate)}`;
        container.appendChild(badge);
    }

    // Deadline (due date)
    if (settings.showDeadline && task.deadline) {
        const badge = document.createElement("span");
        badge.className = "things-badge things-badge-deadline";
        badge.textContent = `\u{1F4C5} ${formatDate(task.deadline)}`;
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
            if (!view.state.field(editorLivePreviewField)) {
                return Decoration.none;
            }
            const cacheState = view.state.field(taskCacheField);
            const builder = new RangeSetBuilder<Decoration>();
            const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
            const uuidRegex = /%%things:([^%]+)%%/g;

            // Build sync-tag regex for whole-word hiding
            const syncTag = cacheState.syncTag;
            const escapedTag = syncTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const tagRegex = new RegExp(`${escapedTag}(?=\\s|$)`);

            for (let i = 1; i <= view.state.doc.lines; i++) {
                if (i === cursorLine) continue;
                const line = view.state.doc.line(i);

                // Only process lines with a Things UUID
                uuidRegex.lastIndex = 0;
                const uuidMatch = uuidRegex.exec(line.text);
                if (!uuidMatch) continue;

                const uuid = uuidMatch[1]!.replace(/^to do id /, "");
                const task = cacheState.tasks.get(uuid);
                const isCheckbox = /^- \[[ x]\] /.test(line.text);

                // Decorations must be added in ascending position order.
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
                    // Consume trailing whitespace
                    while (tagEnd < line.text.length && line.text[tagEnd] === " ") tagEnd++;
                    builder.add(
                        line.from + tagStart,
                        line.from + tagEnd,
                        Decoration.replace({})
                    );
                }

                // 3. Replace UUID comment with metadata widget — link icon last (end of line)
                builder.add(
                    line.from + uuidMatch.index,
                    line.from + uuidMatch.index + uuidMatch[0].length,
                    Decoration.replace({
                        widget: new ThingsMetadataWidget(uuid, task, cacheState),
                    })
                );
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
        private getSettings: () => BadgeSettings & { syncTag: string }
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

                // Hide the sync tag rendered by Obsidian
                const tagEls = li.querySelectorAll("a.tag");
                for (const tagEl of Array.from(tagEls)) {
                    if (tagEl.textContent === settings.syncTag) {
                        (tagEl as HTMLElement).style.display = "none";
                    }
                }

                // Prepend Things logo after checkbox
                const checkbox = li.querySelector(".task-list-item-checkbox");
                if (checkbox) {
                    checkbox.insertAdjacentElement("afterend", createThingsLogo());
                } else {
                    li.prepend(createThingsLogo());
                }

                // Append metadata badges (tags, dates, project, area)
                const task = taskCache.get(uuid);
                if (task) {
                    li.appendChild(createMetadataBadges(task, settings, true));
                }

                // Link icon always last
                li.appendChild(createThingsIcon(uuid));
            }
            liIndex++;
        }
    }
}

export function createThingsPostProcessor(
    app: App,
    getTaskCache: () => Map<string, ThingsTask>,
    getSettings: () => BadgeSettings & { syncTag: string }
) {
    return (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
        const listItems = el.querySelectorAll("li");
        if (listItems.length === 0) return;
        ctx.addChild(new ThingsLinkChild(el, listItems, ctx, app, getTaskCache, getSettings));
    };
}
