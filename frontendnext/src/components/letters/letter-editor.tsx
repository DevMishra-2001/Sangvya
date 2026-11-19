"use client";

// The letter on real A4 pages, the letterhead on each one, like the PDF.
// Type "/" for any command, "{{" for a variable, Ctrl+Enter for a new page.
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";
import { EditorContent, Node, mergeAttributes, useEditor, type Editor, type Range } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TableCell, TableHeader, TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extension-placeholder";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Columns3,
  FileDown,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Redo2,
  RemoveFormatting,
  Rows3,
  Sheet,
  Table2,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CompanyLetterhead, LetterDoc, LetterheadMode } from "@/lib/services/letters";
import { cn } from "@/lib/utils";
import { A4, PT, Pagination, SHEET_GAP, setExtensionStorage, type PageLayout } from "./letter-pages";
import { CommandMenu, type SlashItem } from "./letter-slash";

type Labels = Record<string, string>;
export interface EditorVariable {
  key: string;
  label: string;
  group: string;
  block?: boolean;
}

// {{Employee name}} — one unit in a sentence
const Variable = Node.create<{ labels: Labels }>({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addOptions: () => ({ labels: {} }),
  addAttributes: () => ({ key: { default: null } }),
  parseHTML: () => [{ tag: "span[data-variable]" }],
  renderHTML({ node, HTMLAttributes }) {
    const key = String(node.attrs.key);
    return ["span", mergeAttributes(HTMLAttributes, { "data-variable": key, class: "letter-var" }), `{{${this.options.labels[key] ?? key}}}`];
  },
});

// A whole block filled at print time (e.g. the salary break-up table)
const VariableBlock = Node.create<{ labels: Labels }>({
  name: "variableBlock",
  group: "block",
  atom: true,
  selectable: true,
  addOptions: () => ({ labels: {} }),
  addAttributes: () => ({ key: { default: null } }),
  parseHTML: () => [{ tag: "div[data-variable-block]" }],
  renderHTML({ node, HTMLAttributes }) {
    const key = String(node.attrs.key);
    return ["div", mergeAttributes(HTMLAttributes, { "data-variable-block": key, class: "letter-var-block" }), `▦ ${this.options.labels[key] ?? key} — filled in for each employee`];
  },
});

const LINK_EVENT = "letter:link";
const pageBreakContent = [{ type: "pageBreak" }, { type: "paragraph" }];

// Everything after it starts on the next page
const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: "div[data-page-break]" }],
  renderHTML: () => ["div", { "data-page-break": "", class: "letter-page-break", contenteditable: "false" }, ["span", {}, "Page break — next page starts here"]],
  addKeyboardShortcuts() {
    return { "Mod-Enter": () => this.editor.chain().focus().insertContent(pageBreakContent).run() };
  },
});

// Table cells hold plain paragraphs (that's what the PDF prints)
const Cell = TableCell.extend({ content: "paragraph+" });
const HeadCell = TableHeader.extend({ content: "paragraph+" });

export interface LetterEditorHandle {
  insertVariable: (key: string, block?: boolean) => void;
}

export interface LetterPaper {
  mode: LetterheadMode;
  company: CompanyLetterhead;
  imageUrl: string | null; // uploaded letterhead, page 1 as an image
  margins: { top: number; bottom: number; left: number; right: number }; // pt
  pageNumbers: boolean;
  signOff: { company: string; name: string | null; title: string | null; signature: boolean } | null;
}

function ToolButton({ label, active, onClick, children, disabled }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          className={cn("flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40", active && "bg-primary/10 text-primary")}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-border" aria-hidden />;

function Toolbar({ editor, onLink, pages }: { editor: Editor; onLink: () => void; pages: number }) {
  const c = () => editor.chain().focus();
  const inTable = editor.isActive("table");
  return (
    <div className="border-b bg-muted/30">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1">
        <ToolButton label="Bold (Ctrl+B)" active={editor.isActive("bold")} onClick={() => c().toggleBold().run()}>
          <Bold className="size-4" />
        </ToolButton>
        <ToolButton label="Italic (Ctrl+I)" active={editor.isActive("italic")} onClick={() => c().toggleItalic().run()}>
          <Italic className="size-4" />
        </ToolButton>
        <ToolButton label="Underline (Ctrl+U)" active={editor.isActive("underline")} onClick={() => c().toggleUnderline().run()}>
          <Underline className="size-4" />
        </ToolButton>
        <ToolButton label="Link (Ctrl+K)" active={editor.isActive("link")} onClick={onLink}>
          <Link2 className="size-4" />
        </ToolButton>
        {editor.isActive("link") && (
          <ToolButton label="Remove link" onClick={() => c().extendMarkRange("link").unsetLink().run()}>
            <Link2Off className="size-4" />
          </ToolButton>
        )}
        <ToolButton label="Clear formatting" onClick={() => c().unsetAllMarks().clearNodes().run()}>
          <RemoveFormatting className="size-4" />
        </ToolButton>
        <Sep />
        <ToolButton label="Text" active={editor.isActive("paragraph")} onClick={() => c().setParagraph().run()}>
          <Pilcrow className="size-4" />
        </ToolButton>
        <ToolButton label="Title" active={editor.isActive("heading", { level: 1 })} onClick={() => c().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="size-4" />
        </ToolButton>
        <ToolButton label="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="size-4" />
        </ToolButton>
        <ToolButton label="Sub-heading" active={editor.isActive("heading", { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="size-4" />
        </ToolButton>
        <Sep />
        <ToolButton label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => c().setTextAlign("left").run()}>
          <AlignLeft className="size-4" />
        </ToolButton>
        <ToolButton label="Centre" active={editor.isActive({ textAlign: "center" })} onClick={() => c().setTextAlign("center").run()}>
          <AlignCenter className="size-4" />
        </ToolButton>
        <ToolButton label="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => c().setTextAlign("right").run()}>
          <AlignRight className="size-4" />
        </ToolButton>
        <ToolButton label="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => c().setTextAlign("justify").run()}>
          <AlignJustify className="size-4" />
        </ToolButton>
        <Sep />
        <ToolButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}>
          <List className="size-4" />
        </ToolButton>
        <ToolButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}>
          <ListOrdered className="size-4" />
        </ToolButton>
        <ToolButton label="Line" onClick={() => c().setHorizontalRule().run()}>
          <Minus className="size-4" />
        </ToolButton>
        <ToolButton label="Table" active={inTable} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <Table2 className="size-4" />
        </ToolButton>
        <ToolButton label="New page (Ctrl+Enter)" onClick={() => c().insertContent(pageBreakContent).run()}>
          <FileDown className="size-4" />
        </ToolButton>
        <Sep />
        <ToolButton label="Undo (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => c().undo().run()}>
          <Undo2 className="size-4" />
        </ToolButton>
        <ToolButton label="Redo (Ctrl+Shift+Z)" disabled={!editor.can().redo()} onClick={() => c().redo().run()}>
          <Redo2 className="size-4" />
        </ToolButton>
        <span className="ml-auto hidden items-center gap-3 pr-1 text-2xs text-muted-foreground lg:flex">
          <span>
            <kbd className="rounded border bg-background px-1">/</kbd> commands · <kbd className="rounded border bg-background px-1">{"{{"}</kbd> variables
          </span>
          <span className="font-medium text-foreground">
            {pages} page{pages === 1 ? "" : "s"}
          </span>
        </span>
      </div>
      {inTable && (
        <div className="flex flex-wrap items-center gap-1 border-t bg-background px-2 py-1 text-xs">
          <span className="mr-1 flex items-center gap-1 font-medium text-muted-foreground">
            <Sheet className="size-3.5" /> Table
          </span>
          <Button size="xs" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => c().addRowAfter().run()}>
            <Rows3 /> Row below
          </Button>
          <Button size="xs" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => c().addColumnAfter().run()}>
            <Columns3 /> Column right
          </Button>
          <Button size="xs" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteRow().run()}>
            Delete row
          </Button>
          <Button size="xs" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteColumn().run()}>
            Delete column
          </Button>
          <Button size="xs" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => c().toggleHeaderRow().run()}>
            Header row
          </Button>
          <Button size="xs" variant="ghost" disabled={!editor.can().mergeOrSplit()} onMouseDown={(e) => e.preventDefault()} onClick={() => c().mergeOrSplit().run()}>
            Merge / split
          </Button>
          <Button size="xs" variant="ghost" className="text-destructive" onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteTable().run()}>
            <Trash2 /> Delete table
          </Button>
        </div>
      )}
    </div>
  );
}

// The letterhead printed at the top of each page
function CompanyHead({ head, left, width, ref }: { head: CompanyLetterhead; left: number; width: number; ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="absolute flex gap-[12pt] border-b-[1.2pt] border-[#2563EB] pb-[8pt]" style={{ top: 28 * PT, left, width }}>
      {head.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={head.logoUrl} alt="" className="size-[46pt] shrink-0 object-contain" />
      )}
      <div className={cn("min-w-0 font-[Helvetica,Arial,sans-serif]", head.logoUrl && "min-h-[46pt]")}>
        <div className="text-[15pt] leading-[17.3pt] font-bold text-[#0F172A]">{head.name}</div>
        {head.lines.map((l) => (
          <div key={l} className="mt-[1pt] text-[8.5pt] leading-[9.8pt] text-[#64748B]">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

const pageCss = cn(
  "[&_.ProseMirror]:relative [&_.ProseMirror]:outline-none [&_.ProseMirror]:font-[Helvetica,Arial,sans-serif] [&_.ProseMirror]:text-[10.5pt] [&_.ProseMirror]:leading-[14.64pt] [&_.ProseMirror]:text-[#0F172A]",
  "[&_.ProseMirror_p]:mt-0 [&_.ProseMirror_p]:mb-[6.68pt]",
  "[&_h1]:mt-0 [&_h1]:mb-[12.95pt] [&_h1]:text-[16pt] [&_h1]:leading-[21pt] [&_h1]:font-bold",
  "[&_h2]:mt-0 [&_h2]:mb-[10.92pt] [&_h2]:text-[13.5pt] [&_h2]:leading-[18.1pt] [&_h2]:font-bold",
  "[&_h3]:mt-0 [&_h3]:mb-[9.71pt] [&_h3]:text-[12pt] [&_h3]:leading-[16.37pt] [&_h3]:font-bold",
  "[&_ul]:mt-0 [&_ul]:mb-[2.4pt] [&_ul]:list-disc [&_ul]:pl-[22pt] [&_ol]:mt-0 [&_ol]:mb-[2.4pt] [&_ol]:list-decimal [&_ol]:pl-[22pt]",
  "[&_hr]:mt-[4pt] [&_hr]:mb-[6pt] [&_hr]:border-0 [&_hr]:border-t-[0.6pt] [&_hr]:border-solid [&_hr]:border-[#CBD5E1]",
  "[&_a]:text-[#1D4ED8] [&_a]:underline",
  "[&_table]:mt-0 [&_table]:mb-[8pt] [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse",
  "[&_td]:border-[0.5pt] [&_td]:border-[#CBD5E1] [&_td]:p-[5pt] [&_td]:align-top [&_td]:text-[10pt] [&_td]:leading-[13.56pt]",
  "[&_th]:border-[0.5pt] [&_th]:border-[#CBD5E1] [&_th]:bg-[#F1F5F9] [&_th]:p-[5pt] [&_th]:text-left [&_th]:align-top [&_th]:text-[10pt] [&_th]:leading-[13.56pt] [&_th]:font-bold",
  "[&_td_p]:mb-[2pt] [&_td_p:last-child]:mb-0 [&_th_p]:mb-[2pt] [&_th_p:last-child]:mb-0 [&_.selectedCell]:bg-blue-100/60",
  "[&_.letter-var]:rounded-sm [&_.letter-var]:bg-blue-50 [&_.letter-var]:px-[2px] [&_.letter-var]:font-medium [&_.letter-var]:text-blue-700 [&_.letter-var]:shadow-[0_0_0_1px_#bfdbfe]",
  "[&_.letter-var-block]:mb-[8pt] [&_.letter-var-block]:flex [&_.letter-var-block]:h-[90pt] [&_.letter-var-block]:items-center [&_.letter-var-block]:justify-center [&_.letter-var-block]:rounded-md [&_.letter-var-block]:border [&_.letter-var-block]:border-dashed [&_.letter-var-block]:border-blue-300 [&_.letter-var-block]:bg-blue-50 [&_.letter-var-block]:text-[9pt] [&_.letter-var-block]:text-blue-700",
  "[&_.letter-page-break]:mb-[6pt] [&_.letter-page-break]:flex [&_.letter-page-break]:items-center [&_.letter-page-break]:justify-center [&_.letter-page-break]:border-t-2 [&_.letter-page-break]:border-dashed [&_.letter-page-break]:border-slate-300 [&_.letter-page-break]:pt-[2pt] [&_.letter-page-break]:text-[7.5pt] [&_.letter-page-break]:leading-[10pt] [&_.letter-page-break]:text-slate-400 [&_.letter-page-break]:select-none",
  "[&_.ProseMirror-selectednode]:outline-2 [&_.ProseMirror-selectednode]:outline-primary",
  "[&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-slate-400 [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
  "[&_p.is-empty]:before:pointer-events-none [&_p.is-empty]:before:float-left [&_p.is-empty]:before:h-0 [&_p.is-empty]:before:text-slate-300 [&_p.is-empty]:before:content-[attr(data-placeholder)]",
);

export function LetterEditor({
  value,
  onChange,
  labels,
  variables,
  paper,
  ref,
}: {
  value: LetterDoc;
  onChange: (doc: LetterDoc) => void;
  labels: Labels;
  variables: EditorVariable[];
  paper: LetterPaper;
  ref?: Ref<LetterEditorHandle>;
}) {
  const [link, setLink] = useState<{ href: string } | null>(null);
  const [layout, setLayout] = useState({ pages: 1, signShift: 0 });
  const [headBottom, setHeadBottom] = useState(0);
  const headRef = useRef<HTMLDivElement>(null);
  const signRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentH, setContentH] = useState(0);

  const m = paper.margins;
  // The company letterhead pushes the body down when it's taller than the top space (the PDF does the same)
  const top = Math.max(m.top * PT, paper.mode === "company" && headBottom ? headBottom + 14 * PT : 0);
  const bottom = m.bottom * PT;

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ code: false, codeBlock: false, blockquote: false, strike: false, link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
      TableKit.configure({ table: { resizable: false }, tableCell: false, tableHeader: false }),
      Cell,
      HeadCell,
      Variable.configure({ labels }),
      VariableBlock.configure({ labels }),
      PageBreak,
      Placeholder.configure({ placeholder: "Type / for commands, {{ for a variable", showOnlyCurrent: true }),
      CommandMenu.configure({ char: "/", name: "slash", allowSpaces: false }),
      CommandMenu.extend({ name: "letterVariableMenu" }).configure({ char: "{{", name: "vars", allowSpaces: true }),
      Pagination,
    ],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as LetterDoc),
    editorProps: {
      attributes: { class: "letter-body", "aria-label": "Letter text" },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          event.target?.dispatchEvent(new CustomEvent(LINK_EVENT, { bubbles: true }));
          return true;
        }
        return false;
      },
    },
  });

  const insertVar = (e: Editor, range: Range | null, key: string, block?: boolean) => {
    const chain = e.chain().focus();
    (range ? chain.deleteRange(range) : chain).insertContent(block ? [{ type: "variableBlock", attrs: { key } }, { type: "paragraph" }] : [{ type: "variable", attrs: { key } }, { type: "text", text: " " }]).run();
  };

  // Everything "/" can do
  const commands = useMemo<SlashItem[]>(() => {
    const at = (fn: (e: Editor) => void) => (e: Editor, r: Range) => {
      e.chain().focus().deleteRange(r).run();
      fn(e);
    };
    return [
      { id: "p", group: "Text", label: "Text", icon: Pilcrow, keywords: "paragraph normal", run: at((e) => e.chain().focus().setParagraph().run()) },
      { id: "h1", group: "Text", label: "Title", icon: Heading1, keywords: "heading 1 h1 big", run: at((e) => e.chain().focus().setHeading({ level: 1 }).run()) },
      { id: "h2", group: "Text", label: "Heading", icon: Heading2, keywords: "heading 2 h2", run: at((e) => e.chain().focus().setHeading({ level: 2 }).run()) },
      { id: "h3", group: "Text", label: "Sub-heading", icon: Heading3, keywords: "heading 3 h3 small", run: at((e) => e.chain().focus().setHeading({ level: 3 }).run()) },
      { id: "ul", group: "Text", label: "Bullet list", icon: List, keywords: "unordered points", run: at((e) => e.chain().focus().toggleBulletList().run()) },
      { id: "ol", group: "Text", label: "Numbered list", icon: ListOrdered, keywords: "ordered 1 2 3", run: at((e) => e.chain().focus().toggleOrderedList().run()) },
      { id: "b", group: "Style", label: "Bold", icon: Bold, hint: "Ctrl+B", keywords: "strong", run: at((e) => e.chain().focus().toggleBold().run()) },
      { id: "i", group: "Style", label: "Italic", icon: Italic, hint: "Ctrl+I", run: at((e) => e.chain().focus().toggleItalic().run()) },
      { id: "u", group: "Style", label: "Underline", icon: Underline, hint: "Ctrl+U", run: at((e) => e.chain().focus().toggleUnderline().run()) },
      { id: "link", group: "Style", label: "Link", icon: Link2, hint: "Ctrl+K", keywords: "url website", run: at((e) => e.view.dom.dispatchEvent(new CustomEvent(LINK_EVENT, { bubbles: true }))) },
      { id: "al", group: "Style", label: "Align left", icon: AlignLeft, run: at((e) => e.chain().focus().setTextAlign("left").run()) },
      { id: "ac", group: "Style", label: "Centre", icon: AlignCenter, keywords: "center middle", run: at((e) => e.chain().focus().setTextAlign("center").run()) },
      { id: "ar", group: "Style", label: "Align right", icon: AlignRight, run: at((e) => e.chain().focus().setTextAlign("right").run()) },
      { id: "aj", group: "Style", label: "Justify", icon: AlignJustify, run: at((e) => e.chain().focus().setTextAlign("justify").run()) },
      { id: "table", group: "Insert", label: "Table", icon: Table2, keywords: "grid rows columns", run: at((e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()) },
      { id: "hr", group: "Insert", label: "Line", icon: Minus, keywords: "divider rule separator", run: at((e) => e.chain().focus().setHorizontalRule().run()) },
      { id: "page", group: "Insert", label: "New page", icon: FileDown, hint: "Ctrl+Enter", keywords: "page break next", run: at((e) => e.chain().focus().insertContent(pageBreakContent).run()) },
    ];
  }, []);
  const varItems = useMemo<SlashItem[]>(
    () => variables.map((v) => ({ id: `v-${v.key}`, group: v.group, label: v.label, icon: v.block ? Table2 : undefined, keywords: `variable ${v.key}`, run: (e: Editor, r: Range) => insertVar(e, r, v.key, v.block) })),
    [variables],
  );
  // What the menus offer and the page sizes, handed to the editor's extensions
  useLayoutEffect(() => {
    if (!editor) return;
    setExtensionStorage(editor, "letterCommandMenu", { items: [...commands, ...varItems] });
    setExtensionStorage(editor, "letterVariableMenu", { items: varItems });
  }, [editor, commands, varItems]);
  useLayoutEffect(() => {
    if (!editor) return;
    const layout: PageLayout = { top, bottom, signOff: () => signRef.current?.offsetHeight ?? 0, onLayout: setLayout };
    setExtensionStorage(editor, "letterPages", { layout });
  }, [editor, top, bottom]);
  const showLink = () => editor && setLink({ href: (editor.getAttributes("link").href as string | undefined) ?? "" });
  // Ctrl+K and "/ Link" ask for the link dialog
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const open = () => setLink({ href: (editor.getAttributes("link").href as string | undefined) ?? "" });
    dom.addEventListener(LINK_EVENT, open);
    return () => dom.removeEventListener(LINK_EVENT, open);
  }, [editor]);

  // A different template loaded (e.g. a starter for another type)
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  // The letterhead's height (company letterhead) and a fresh page split when the paper changes
  useLayoutEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const measure = () => setHeadBottom(el.offsetTop + el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paper.mode, paper.company]);
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta("letterPagesRefresh", true));
  }, [editor, top, bottom, paper.signOff, paper.margins.left, paper.margins.right]);
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContentH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [editor]);

  useImperativeHandle(ref, () => ({ insertVariable: (key, block) => editor && insertVar(editor, null, key, block) }));

  const step = A4.h + SHEET_GAP;
  // Enough sheets for the split, and for a block taller than a page
  const sheets = Math.max(layout.pages, Math.ceil((contentH + bottom) / step));
  const left = m.left * PT;
  const width = A4.w - (m.left + m.right) * PT;

  function saveLink(href: string) {
    if (!editor) return;
    const url = href.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!url) chain.unsetLink().run();
    else if (editor.state.selection.empty && !editor.isActive("link")) editor.chain().focus().insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] }).run();
    else chain.setLink({ href: url }).run();
    setLink(null);
  }

  if (!editor) return <div className="h-[70vh] rounded-lg border bg-muted/30" />;
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Toolbar editor={editor} pages={sheets} onLink={showLink} />
      <div className="max-h-[78vh] overflow-auto bg-slate-200/70 p-4 dark:bg-slate-800/60">
        <div className="relative mx-auto" style={{ width: A4.w, minHeight: sheets * step - SHEET_GAP }}>
          {/* The paper: one sheet per page, each with the letterhead */}
          {Array.from({ length: sheets }, (_, i) => (
            <div key={i} aria-hidden className="absolute left-0 overflow-hidden bg-white shadow-md ring-1 ring-black/5" style={{ top: i * step, width: A4.w, height: A4.h }}>
              {paper.mode === "upload" && paper.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={paper.imageUrl} alt="" className="absolute inset-0 size-full object-fill" />
              )}
              {paper.mode === "company" && <CompanyHead head={paper.company} left={left} width={width} ref={i === 0 ? headRef : undefined} />}
              <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-sky-300/70" style={{ top }} />
              <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-sky-300/70" style={{ top: A4.h - bottom }} />
              {paper.pageNumbers && sheets > 1 && (
                <div className="absolute inset-x-0 text-center font-[Helvetica,Arial,sans-serif] text-[8pt] text-[#64748B]" style={{ top: A4.h - bottom + 6 * PT }}>
                  Page {i + 1} of {sheets}
                </div>
              )}
            </div>
          ))}
          <div ref={contentRef} className={cn("relative", pageCss)} style={{ paddingTop: top, paddingLeft: left, paddingRight: A4.w - left - width }}>
            <EditorContent editor={editor} />
            {paper.signOff && (
              <div ref={signRef} className="pt-[12pt] font-[Helvetica,Arial,sans-serif] text-[10.5pt] leading-[12.14pt] text-[#0F172A] select-none" style={{ marginTop: layout.signShift }}>
                <div>For {paper.signOff.company}</div>
                <div className={cn("my-[5pt] flex items-center text-[8pt] text-slate-400", paper.signOff.signature ? "h-[52pt]" : "h-[30pt]")}>{paper.signOff.signature ? "[signature]" : ""}</div>
                {paper.signOff.name && <div className="font-bold">{paper.signOff.name}</div>}
                {paper.signOff.title && <div className="text-[10pt] leading-[11.56pt] text-[#64748B]">{paper.signOff.title}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={Boolean(link)} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link</DialogTitle>
            <DialogDescription>Select text first to turn it into a link, or add the web address on its own.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveLink(String(new FormData(e.currentTarget).get("href") ?? ""));
            }}
          >
            <Input name="href" autoFocus defaultValue={link?.href} placeholder="https://www.example.com" aria-label="Web address" />
            <DialogFooter className="mt-4">
              {link?.href && (
                <Button type="button" variant="outline" onClick={() => saveLink("")} className="mr-auto">
                  <Link2Off /> Remove link
                </Button>
              )}
              <Button type="submit">Save link</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
