import { App, MarkdownPostProcessorContext, MarkdownRenderChild, editorLivePreviewField } from "obsidian";
import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, WidgetType, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { taskCacheField, TaskCacheState } from "./task-cache-state";
import type { ThingsTask, ThingsSyncSettings } from "./types";

// --- Shared helpers ---

function createThingsIcon(uuid: string): HTMLElement {
    const cleanUuid = uuid.replace(/^to do id /, "");
    const icon = document.createElement("span");
    icon.className = "things-link-icon";
    icon.setAttribute("aria-label", `Things: ${cleanUuid}`);
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

function createMetadataBadges(task: ThingsTask, settings: BadgeSettings): DocumentFragment {
    const frag = document.createDocumentFragment();
    const container = document.createElement("span");
    container.className = "things-inline-meta";

    if (settings.showProject && task.projectTitle) {
        const badge = document.createElement("span");
        badge.className = "things-badge things-badge-project";
        badge.textContent = task.projectTitle;
        container.appendChild(badge);
    }

    if (settings.showArea && task.areaTitle) {
        const badge = document.createElement("span");
        badge.className = "things-badge things-badge-area";
        badge.textContent = task.areaTitle;
        container.appendChild(badge);
    }

    if (settings.showDeadline && task.deadline) {
        const badge = document.createElement("span");
        badge.className = "things-badge things-badge-deadline";
        badge.textContent = `\u{1F4C5} ${formatDate(task.deadline)}`;
        container.appendChild(badge);
    }

    if (settings.showStartDate && task.startDate) {
        const badge = document.createElement("span");
        badge.className = "things-badge things-badge-start";
        badge.textContent = `\u{1F4C6} ${formatDate(task.startDate)}`;
        container.appendChild(badge);
    }

    if (settings.showTags && task.tags.length > 0) {
        for (const tag of task.tags) {
            const badge = document.createElement("span");
            badge.className = "things-badge things-badge-tag";
            badge.textContent = tag;
            container.appendChild(badge);
        }
    }

    if (container.childNodes.length > 0) {
        frag.appendChild(container);
    }
    return frag;
}

// --- Live preview: ThingsMetadataWidget ---

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
        wrapper.appendChild(createThingsIcon(this.uuid));
        if (this.task) {
            wrapper.appendChild(createMetadataBadges(this.task, this.cacheState));
        }
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
            const regex = /%%things:([^%]+)%%/g;
            for (let i = 1; i <= view.state.doc.lines; i++) {
                if (i === cursorLine) continue;
                const line = view.state.doc.line(i);
                let m;
                while ((m = regex.exec(line.text)) !== null) {
                    const uuid = m[1]!.replace(/^to do id /, "");
                    const task = cacheState.tasks.get(uuid);
                    builder.add(
                        line.from + m.index,
                        line.from + m.index + m[0].length,
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
        private getSettings: () => BadgeSettings
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
                const li = this.listItems[liIndex]!;
                li.appendChild(createThingsIcon(uuid));
                const task = taskCache.get(uuid);
                if (task) {
                    li.appendChild(createMetadataBadges(task, settings));
                }
            }
            liIndex++;
        }
    }
}

export function createThingsPostProcessor(
    app: App,
    getTaskCache: () => Map<string, ThingsTask>,
    getSettings: () => BadgeSettings
) {
    return (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
        const listItems = el.querySelectorAll("li");
        if (listItems.length === 0) return;
        ctx.addChild(new ThingsLinkChild(el, listItems, ctx, app, getTaskCache, getSettings));
    };
}
