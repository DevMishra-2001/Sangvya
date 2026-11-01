"use client";

// Horizontal menu (desktop): one scrollable row; groups open on hover; ‹ › scroll it; search finds any page
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { buildNav, isActive, isGroup, type NavGroup, type NavLink } from "./nav-items";

const itemClass = (active: boolean) =>
  cn(
    "relative flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

function TopLink({ link }: { link: NavLink }) {
  const active = isActive(usePathname(), link);
  const Icon = link.icon;
  return (
    <Link href={link.href} aria-current={active ? "page" : undefined} data-active={active || undefined} className={itemClass(active)}>
      <Icon className="size-4" />
      {link.label}
    </Link>
  );
}

// A group: hover (or click) shows its pages in a dropdown below
function TopGroup({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = group.children.some((c) => isActive(pathname, c));
  const Icon = group.icon;

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 150); // time to move into the dropdown
  };
  useEffect(() => () => void (closeTimer.current && clearTimeout(closeTimer.current)), []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" onMouseEnter={show} onMouseLeave={hide} data-active={active || undefined} className={itemClass(active)}>
          <Icon className="size-4" />
          {group.label}
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-60 p-1.5" onMouseEnter={show} onMouseLeave={hide} onOpenAutoFocus={(e) => e.preventDefault()}>
        <p className="px-2 pt-1 pb-1.5 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">{group.label}</p>
        <div className="flex flex-col gap-0.5 border-t border-l-2 border-l-primary/40 pt-1 pl-1">
          {group.children.map((c) => {
            const on = isActive(pathname, c);
            const ChildIcon = c.icon;
            return (
              <Link
                key={c.href}
                href={c.href}
                onClick={() => setOpen(false)}
                aria-current={on ? "page" : undefined}
                className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm", on ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}
              >
                <ChildIcon className="size-4 text-muted-foreground" />
                {c.label}
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Find any page by name (groups' pages included)
function NavSearch({ links }: { links: (NavLink & { group?: string })[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const results = (query ? links.filter((l) => l.label.toLowerCase().includes(query) || l.group?.toLowerCase().includes(query)) : links).slice(0, 12);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Search pages">
          <Search />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 p-2">
        <Input
          autoFocus
          placeholder="Search pages…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) go(results[0].href);
          }}
          aria-label="Search pages"
        />
        <div className="mt-2 flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">No pages match.</p>
          ) : (
            results.map((l) => {
              const Icon = l.icon;
              return (
                <button key={l.href} type="button" onClick={() => go(l.href)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{l.label}</span>
                  {l.group && <span className="truncate text-xs text-muted-foreground">{l.group}</span>}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const pages = useAuthStore((s) => s.pages);
  const teamSize = useAuthStore((s) => s.user?.team_size ?? 0);
  const nav = useMemo(() => buildNav(teamSize ? pages : pages.filter((p) => p.slug !== "my-team")), [pages, teamSize]);
  const links = useMemo(() => nav.flatMap((i) => (isGroup(i) ? i.children.map((c) => ({ ...c, group: i.label })) : [i])), [nav]);
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  // Which scroll buttons can move
  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [update, nav]);

  // Keep the current page's item in view
  useEffect(() => {
    scroller.current?.querySelector("[data-active]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  const scrollBy = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.6, behavior: "smooth" });

  return (
    <nav aria-label="Main" className="sticky top-16 z-20 hidden h-12 items-center gap-1 border-b bg-background/90 px-3 backdrop-blur-md lg:flex">
      <Button variant="ghost" size="icon-sm" onClick={() => scrollBy(-1)} disabled={!edges.left} aria-label="Scroll menu left">
        <ChevronLeft />
      </Button>
      <div ref={scroller} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {nav.map((item) => (isGroup(item) ? <TopGroup key={item.key} group={item} /> : <TopLink key={item.href} link={item} />))}
      </div>
      <Button variant="ghost" size="icon-sm" onClick={() => scrollBy(1)} disabled={!edges.right} aria-label="Scroll menu right">
        <ChevronRight />
      </Button>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <NavSearch links={links} />
    </nav>
  );
}
