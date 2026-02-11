import { MarkdownPostProcessorContext } from "obsidian";
import { ViewPlugin, ViewUpdate, DecorationSet, Decoration, WidgetType, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

function createThingsIcon(uuid: string): HTMLElement {
    const icon = document.createElement("span");
    icon.className = "things-link-icon";
    icon.setAttribute("aria-label", `Things: ${uuid}`);
    icon.setAttribute("data-tooltip-position", "top");
    icon.textContent = "🔗";
    icon.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(`things:///show?id=${uuid}`);
    });
    return icon;
}

export function thingsPostProcessor(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const listItems = el.querySelectorAll("li");
    for (const li of Array.from(listItems)) {
        const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
        let node: Text | null;
        while ((node = walker.nextNode() as Text | null)) {
            const match = node.textContent?.match(/%%things:([^%]+)%%/);
            if (match) {
                const uuid = match[1]!;
                node.textContent = node.textContent!.replace(/%%things:[^%]+%%/, "");
                li.appendChild(createThingsIcon(uuid));
            }
        }
    }
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
