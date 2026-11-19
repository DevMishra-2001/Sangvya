// Splits the letter into A4 pages while typing: before a block that doesn't fit, a gap pushes it to the next
// page — same rules as the PDF (a block that fits on a page isn't split, a heading isn't left at the bottom,
// a page break starts a new page)
import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const PT = 4 / 3; // CSS px per point
export const A4 = { w: 595.28 * PT, h: 841.89 * PT };
export const SHEET_GAP = 24; // px between sheets
const KEEP_WITH_NEXT = 30 * PT;

export interface PageLayout {
  top: number; // px, body start on every page
  bottom: number; // px, bottom margin
  signOff: () => number; // px height of the sign-off under the body
  onLayout: (l: { pages: number; signShift: number }) => void;
}

interface Break {
  pos: number;
  height: number;
}

const key = new PluginKey<DecorationSet>("letterPages");

function gapWidget(height: number) {
  const el = document.createElement("div");
  el.className = "letter-page-gap";
  el.contentEditable = "false";
  el.style.height = `${height}px`;
  return el;
}

// (the page sizes live in the extension's storage, set by the editor component)
export const Pagination = Extension.create<object, { layout: PageLayout }>({
  name: "letterPages",
  addStorage: () => ({ layout: { top: 0, bottom: 0, signOff: () => 0, onLayout: () => {} } }),
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const breaks = tr.getMeta(key) as Break[] | undefined;
            if (breaks) return DecorationSet.create(tr.doc, breaks.map((b) => Decoration.widget(b.pos, () => gapWidget(b.height), { side: -1, key: `gap-${b.pos}-${Math.round(b.height)}`, ignoreSelection: true })));
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: { decorations: (state) => key.getState(state) },
        view(view) {
          let frame = 0;
          let last = "";
          let lastLayout = "";
          const measure = () => {
            const { top, bottom, signOff, onLayout } = storage.layout;
            const dom = view.dom as HTMLElement;
            const contentH = A4.h - top - bottom;
            const gaps = Array.from(dom.querySelectorAll<HTMLElement>(":scope > .letter-page-gap"));
            // Where a block would be without the gaps (the editor's top space is outside it)
            const natural = (el: HTMLElement) => el.offsetTop - gaps.reduce((s, g) => (g.offsetTop <= el.offsetTop ? s + g.offsetHeight : s), 0);
            const breaks: Break[] = [];
            let pageStart = 0;
            let forceNext = false;
            let lastBottom = 0;
            view.state.doc.forEach((node, offset) => {
              const el = view.nodeDOM(offset);
              if (!(el instanceof HTMLElement)) return;
              const t = natural(el);
              const h = el.offsetHeight;
              const isBreak = node.type.name === "pageBreak";
              const need = h + (node.type.name === "heading" ? KEEP_WITH_NEXT : 0);
              const moveDown = forceNext || (!isBreak && t > pageStart + 1 && t - pageStart + need > contentH && need <= contentH);
              if (moveDown) {
                // Whatever is left of this page, its bottom margin, the gap, the next page's top margin
                breaks.push({ pos: offset, height: pageStart + contentH - t + bottom + SHEET_GAP + top });
                pageStart = t;
              }
              forceNext = isBreak;
              lastBottom = t + h + (parseFloat(getComputedStyle(el).marginBottom) || 0);
            });
            // The sign-off moves to a new page when it doesn't fit under the last block
            let pages = breaks.length + 1;
            let signShift = 0;
            const sign = signOff();
            if (sign > 0 && lastBottom - pageStart + sign > contentH && lastBottom > pageStart + 1) {
              signShift = pageStart + contentH - lastBottom + bottom + SHEET_GAP + top;
              pages += 1;
            }
            const next = JSON.stringify(breaks);
            if (next !== last) {
              last = next;
              view.dispatch(view.state.tr.setMeta(key, breaks).setMeta("addToHistory", false));
            }
            const l = JSON.stringify({ pages, signShift: Math.round(signShift) });
            if (l !== lastLayout) {
              lastLayout = l;
              onLayout({ pages, signShift: Math.round(signShift) });
            }
          };
          const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(measure);
          };
          schedule();
          void document.fonts?.ready.then(schedule);
          return { update: schedule, destroy: () => cancelAnimationFrame(frame) };
        },
      }),
    ];
  },
});

// Hands values to an extension's storage (menu items, page sizes)
export function setExtensionStorage(editor: { storage: unknown }, extension: string, patch: object) {
  const all = editor.storage as Record<string, object | undefined>;
  if (all[extension]) Object.assign(all[extension], patch);
}
