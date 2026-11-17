"use client";

// Horizontal menu (desktop): one scrollable row; groups open on hover; ‹ › scroll it; search opens the command palette
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useCommandStore } from "@/stores/command-store";
import {
  buildNav,
  isActive,
  isGroup,
  type NavGroup,
  type NavLink,
} from "./nav-items";

const itemClass = (active: boolean) =>
  cn(
    "relative flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "bg-primary/10 font-medium text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

function TopLink({ link }: { link: NavLink }) {
  const active = isActive(usePathname(), link);
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      data-active={active || undefined}
      className={itemClass(active)}
    >
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
  useEffect(
    () => () => void (closeTimer.current && clearTimeout(closeTimer.current)),
    [],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={show}
          onMouseLeave={hide}
          data-active={active || undefined}
          className={itemClass(active)}
        >
          <Icon className="size-4" />
          {group.label}
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-60 p-1.5"
        onMouseEnter={show}
        onMouseLeave={hide}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="px-2 pt-1 pb-1.5 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
          {group.label}
        </p>
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
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  on
                    ? "bg-primary/10 font-medium text-primary"
                    : "hover:bg-muted",
                )}
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

// Search: opens the command palette (pages, actions, people, tickets)
function NavSearch() {
  const open = useCommandStore((st) => st.setPalette);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => open(true)}
      aria-label="Search (Ctrl+K)"
      className="gap-1.5 text-muted-foreground"
    >
      <Search />
      <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">
        Ctrl K
      </kbd>
    </Button>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const pages = useAuthStore((s) => s.pages);
  const teamSize = useAuthStore((s) => s.user?.team_size ?? 0);
  const nav = useMemo(
    () =>
      buildNav(teamSize ? pages : pages.filter((p) => p.slug !== "my-team")),
    [pages, teamSize],
  );
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  // Which scroll buttons can move
  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
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
    scroller.current
      ?.querySelector("[data-active]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  const scrollBy = (dir: 1 | -1) =>
    scroller.current?.scrollBy({
      left: dir * scroller.current.clientWidth * 0.6,
      behavior: "smooth",
    });

  return (
    <nav
      aria-label="Main"
      className="sticky top-16 z-20 hidden h-12 items-center gap-1 border-b bg-background/90 px-3 backdrop-blur-md lg:flex"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => scrollBy(-1)}
        disabled={!edges.left}
        aria-label="Scroll menu left"
      >
        <ChevronLeft />
      </Button>
      <div
        ref={scroller}
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {nav.map((item) =>
          isGroup(item) ? (
            <TopGroup key={item.key} group={item} />
          ) : (
            <TopLink key={item.href} link={item} />
          ),
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => scrollBy(1)}
        disabled={!edges.right}
        aria-label="Scroll menu right"
      >
        <ChevronRight />
      </Button>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <NavSearch />
    </nav>
  );
}
