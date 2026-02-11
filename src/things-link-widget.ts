import { MarkdownPostProcessorContext, MarkdownRenderChild, editorLivePreviewField } from "obsidian";
import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, WidgetType, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

function createThingsIcon(uuid: string): HTMLElement {
    // Strip legacy "to do id " prefix if present
    const cleanUuid = uuid.replace(/^to do id /, "");
    const icon = document.createElement("span");
    icon.className = "things-link-icon";
    icon.setAttribute("aria-label", `Things: ${cleanUuid}`);
    icon.setAttribute("data-tooltip-position", "top");
    icon.textContent = "🔗";
    // Use mousedown to fire before CodeMirror moves the cursor and removes the widget
    icon.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(`things:///show?id=${cleanUuid}`);
    });
    return icon;
}

class ThingsLinkChild extends MarkdownRenderChild {
    constructor(
        containerEl: HTMLElement,
        private listItems: NodeListOf<Element>,
        private ctx: MarkdownPostProcessorContext
    ) {
        super(containerEl);
    }

    onload() {
        // Deferred until element is attached to DOM, so getSectionInfo works
        const section = this.ctx.getSectionInfo(this.containerEl);
        if (!section) return;

        const sourceLines = section.text.split("\n").slice(section.lineStart, section.lineEnd + 1);
        let liIndex = 0;
        for (const line of sourceLines) {
            if (!/^- \[[ x]\]/.test(line)) continue;
            const uuidMatch = line.match(/%%things:([^%]+)%%/);
            if (uuidMatch && liIndex < this.listItems.length) {
                this.listItems[liIndex]!.appendChild(createThingsIcon(uuidMatch[1]!));
            }
            liIndex++;
        }
    }
}

export function thingsPostProcessor(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const listItems = el.querySelectorAll("li");
    if (listItems.length === 0) return;
    ctx.addChild(new ThingsLinkChild(el, listItems, ctx));
}

class ThingsLinkWidget extends WidgetType {
    constructor(readonly uuid: string) { super(); }
    toDOM(): HTMLElement { return createThingsIcon(this.uuid); }
}

export const thingsLinkViewPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        constructor(view: EditorView) { this.decorations = this.build(view); }
        update(update: ViewUpdate) {
            if (update.docChanged || update.selectionSet) this.decorations = this.build(update.view);
        }
        build(view: EditorView): DecorationSet {
            // Only replace in live preview, not source mode
            if (!view.state.field(editorLivePreviewField)) {
                return Decoration.none;
            }
            const builder = new RangeSetBuilder<Decoration>();
            const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
            const regex = /%%things:([^%]+)%%/g;
            for (let i = 1; i <= view.state.doc.lines; i++) {
                if (i === cursorLine) continue;
                const line = view.state.doc.line(i);
                let m;
                while ((m = regex.exec(line.text)) !== null) {
                    builder.add(
                        line.from + m.index,
                        line.from + m.index + m[0].length,
                        Decoration.replace({ widget: new ThingsLinkWidget(m[1]!) })
                    );
                }
            }
            return builder.finish();
        }
    },
    { decorations: (v) => v.decorations }
);
