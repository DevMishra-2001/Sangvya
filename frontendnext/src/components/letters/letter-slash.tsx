"use client";

// "/" opens a menu of everything the editor can do (headings, styles, link, table, page break, variables);
// "{{" opens just the variables. Type to filter, ↑ ↓ to move, Enter to pick, Esc to close.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Extension, ReactRenderer, type Editor, type Range } from "@tiptap/react";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SlashItem {
  id: string;
  label: string;
  group: string;
  icon?: LucideIcon;
  hint?: string; // e.g. a keyboard shortcut
  keywords?: string;
  run: (editor: Editor, range: Range) => void;
}

export const filterItems = (items: SlashItem[], query: string) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter((i) => {
    const hay = `${i.label} ${i.group} ${i.keywords ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
};

interface ListHandle {
  onKeyDown: (p: SuggestionKeyDownProps) => boolean;
}

const SlashList = forwardRef<ListHandle, SuggestionProps<SlashItem, SlashItem>>(function SlashList({ items, command }, ref) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const [prevItems, setPrevItems] = useState(items);
  if (prevItems !== items) {
    setPrevItems(items);
    setActive(0);
  }

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false;
      if (event.key === "ArrowDown") {
        setActive((a) => (a + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setActive((a) => (a - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const item = items[active];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) return <div className="w-64 rounded-lg border bg-popover p-3 text-xs text-muted-foreground shadow-lg">Nothing matches — keep typing or press Esc</div>;
  let group = "";
  return (
    <div ref={listRef} role="listbox" aria-label="Insert" className="max-h-80 w-72 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
      {items.map((item, i) => {
        const head = item.group !== group ? item.group : null;
        group = item.group;
        const Icon = item.icon;
        return (
          <div key={item.id}>
            {head && <div className="px-2 pt-2 pb-1 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">{head}</div>}
            <button
              type="button"
              role="option"
              aria-selected={i === active}
              data-index={i}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => command(item)}
              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm", i === active && "bg-accent text-accent-foreground")}
            >
              {Icon ? (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background">
                  <Icon className="size-4" />
                </span>
              ) : (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-2xs font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">{"{}"}</span>
              )}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.hint && <kbd className="text-2xs text-muted-foreground">{item.hint}</kbd>}
            </button>
          </div>
        );
      })}
    </div>
  );
});

// One trigger ("/" or "{{") with its own list of items
// (the items live in the extension's storage, set by the editor component)
export const CommandMenu = Extension.create<{ char: string; name: string; allowSpaces: boolean }, { items: SlashItem[] }>({
  name: "letterCommandMenu",
  addOptions: () => ({ char: "/", name: "slash", allowSpaces: false }),
  addStorage: () => ({ items: [] }),
  addProseMirrorPlugins() {
    const { char, name, allowSpaces } = this.options;
    const storage = this.storage;
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        pluginKey: new PluginKey(`letter-${name}`),
        char,
        allowSpaces,
        items: ({ query }) => filterItems(storage.items, query).slice(0, 80),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer: ReactRenderer<ListHandle, SuggestionProps<SlashItem, SlashItem>> | null = null;
          let unmount: (() => void) | null = null;
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashList, { props, editor: props.editor });
              renderer.element.style.zIndex = "60";
              unmount = props.mount(renderer.element as HTMLElement);
            },
            onUpdate: (props) => renderer?.updateProps(props),
            onKeyDown: (props) => {
              if (props.event.key === "Escape") return false;
              return renderer?.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              unmount?.();
              renderer?.destroy();
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});
