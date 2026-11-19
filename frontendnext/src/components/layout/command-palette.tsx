"use client";

// Ctrl/⌘+K: jump to any page, start a common action, or find a person / ticket / candidate.
// Records come from the server only after 2+ letters, one request per pause in typing.
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  Clock,
  Keyboard,
  LogOut,
  Moon,
  Sun,
  Ticket,
} from "lucide-react";
import { useTheme } from "next-themes";
import { PersonAvatar } from "@/components/common/person-avatar";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { useCommandStore } from "@/stores/command-store";
import {
  keyLabel,
  useCommands,
  useMenuPages,
  type CommandEntry,
} from "./commands";

interface SearchResult {
  people: {
    id: number;
    name: string;
    code: string | null;
    photo_url: string | null;
    designation: string | null;
  }[];
  tickets: {
    id: number;
    code: string;
    title: string;
    status_name: string;
    status_color: string;
  }[];
  candidates: { id: number; name: string; stage: string; job: string }[];
}

const RECENT_KEY = "wk-recent-pages";
const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};

// Keys shown next to an item: G then T
function Keys({ keys }: { keys?: string[] }) {
  if (!keys) return null;
  return (
    <CommandShortcut className="flex gap-1 tracking-normal">
      {keyLabel(keys).map((k, i) => (
        <kbd
          key={i}
          className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none"
        >
          {k}
        </kbd>
      ))}
    </CommandShortcut>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const open = useCommandStore((s) => s.palette);
  const setOpen = useCommandStore((s) => s.setPalette);
  const setHelp = useCommandStore((s) => s.setHelp);
  const logout = useAuthStore((s) => s.logout);
  const { resolvedTheme, setTheme } = useTheme();
  const pages = useMenuPages();
  const commands = useCommands();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const seq = useRef(0);

  // Remember the pages people open (this browser only)
  useEffect(() => {
    if (!pages.some((p) => p.href === pathname)) return;
    try {
      const next = [
        pathname,
        ...readRecent().filter((h) => h !== pathname),
      ].slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // storage blocked — recents just stay empty
    }
  }, [pathname, pages]);

  // Fresh each time it opens
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setQuery("");
      setResults(null);
      setRecent(readRecent());
    });
  }, [open]);

  // Records: wait for a pause in typing, then one request
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      queueMicrotask(() => {
        setResults(null);
        setSearching(false);
      });
      return;
    }
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get<SearchResult>("/search", {
          params: { q },
        });
        if (id === seq.current) setResults(data);
      } catch {
        if (id === seq.current) setResults(null);
      } finally {
        if (id === seq.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const runCommand = (c: CommandEntry) => {
    setOpen(false);
    if (c.event) window.dispatchEvent(new Event(c.event));
    else if (c.href) router.push(c.href);
  };

  const recentPages = recent
    .map((h) => pages.find((p) => p.href === h))
    .filter((p): p is (typeof pages)[number] => Boolean(p));
  const groups = ["Create", "Attendance", "Go to"] as const;
  const hasRecords =
    results &&
    (results.people.length ||
      results.tickets.length ||
      results.candidates.length);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Search pages, actions, people and tickets"
    >
      <CommandInput
        placeholder="Search pages, actions, people, tickets…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? "Searching…" : "Nothing found."}
        </CommandEmpty>

        {!query && recentPages.length > 0 && (
          <CommandGroup heading="Recent">
            {recentPages.map((p) => (
              <CommandItem
                key={`recent-${p.href}`}
                value={`recent ${p.label} ${p.group ?? ""}`}
                onSelect={() => go(p.href)}
              >
                <Clock />
                {p.label}
                {p.group && (
                  <span className="text-xs text-muted-foreground">
                    · {p.group}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* People, tickets and candidates from the server */}
        {searching && !hasRecords && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
            <Spinner /> Searching records…
          </div>
        )}
        {results && results.people.length > 0 && (
          <CommandGroup heading="People">
            {results.people.map((p) => (
              <CommandItem
                key={`p-${p.id}`}
                value={`person ${p.name} ${p.code ?? ""} ${query}`}
                onSelect={() => go(`/employees/${p.id}`)}
              >
                <PersonAvatar
                  name={p.name}
                  photoUrl={p.photo_url}
                  className="size-6 text-[10px]"
                />
                <span className="truncate">{p.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {[p.code, p.designation].filter(Boolean).join(" · ")}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results && results.tickets.length > 0 && (
          <CommandGroup heading="Tickets">
            {results.tickets.map((t) => (
              <CommandItem
                key={`t-${t.id}`}
                value={`ticket ${t.code} ${t.title} ${query}`}
                onSelect={() => go(`/tickets?id=${t.id}`)}
              >
                <Ticket />
                <span className="font-mono text-xs font-semibold text-primary">
                  {t.code}
                </span>
                <span className="truncate">{t.title}</span>
                <span
                  className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `${t.status_color}1f`,
                    color: t.status_color,
                  }}
                >
                  {t.status_name}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results && results.candidates.length > 0 && (
          <CommandGroup heading="Candidates">
            {results.candidates.map((c) => (
              <CommandItem
                key={`c-${c.id}`}
                value={`candidate ${c.name} ${query}`}
                onSelect={() =>
                  go(`/recruitment?tab=candidates&candidate=${c.id}`)
                }
              >
                <Briefcase />
                <span className="truncate">{c.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {c.job} · {c.stage}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {groups.map((g) => {
          const items = commands.filter((c) => c.group === g);
          if (!items.length) return null;
          return (
            <CommandGroup key={g} heading={g === "Go to" ? "Quick jump" : g}>
              {items.map((c) => {
                const Icon = c.icon;
                return (
                  <CommandItem
                    key={c.id}
                    value={`${c.label} ${(c.keywords ?? []).join(" ")}`}
                    onSelect={() => runCommand(c)}
                  >
                    <Icon />
                    {c.label}
                    <Keys keys={c.keys} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}

        <CommandGroup heading="All pages">
          {pages.map((p) => {
            const Icon = p.icon;
            return (
              <CommandItem
                key={`page-${p.href}`}
                value={`page ${p.label} ${p.group ?? ""}`}
                onSelect={() => go(p.href)}
              >
                <Icon />
                {p.label}
                {p.group && (
                  <span className="text-xs text-muted-foreground">
                    · {p.group}
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem
            value="theme dark light mode"
            onSelect={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
          </CommandItem>
          <CommandItem
            value="keyboard shortcuts help"
            onSelect={() => {
              setOpen(false);
              setHelp(true);
            }}
          >
            <Keyboard />
            Keyboard shortcuts
            <Keys keys={["?"]} />
          </CommandItem>
          <CommandItem
            value="log out sign out"
            onSelect={() => {
              setOpen(false);
              void logout();
            }}
          >
            <LogOut />
            Log out
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="flex items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span>
          <kbd className="rounded border px-1">↑</kbd>{" "}
          <kbd className="rounded border px-1">↓</kbd> move
        </span>
        <span>
          <kbd className="rounded border px-1">Enter</kbd> open
        </span>
        <span>
          <kbd className="rounded border px-1">Esc</kbd> close
        </span>
      </div>
    </CommandDialog>
  );
}
