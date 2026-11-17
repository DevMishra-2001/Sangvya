"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";
import { CompanyLogo } from "@/components/companies/company-logo";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useCommandStore } from "@/stores/command-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import {
  buildNav,
  isActive,
  isGroup,
  type NavGroup,
  type NavItem,
  type NavLink,
} from "./nav-items";

// collapsed = desktop icon rail: icons only, names in tooltips
interface NavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

// The current company's logo (or initial) and name; "Workkind" until one exists
function Brand({ collapsed }: { collapsed?: boolean }) {
  const company = useAuthStore((s) => s.company);
  const name = company?.name ?? "Workkind";
  return (
    <div
      className={cn(
        "flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border",
        collapsed ? "justify-center px-2" : "px-5",
      )}
    >
      <CompanyLogo name={name} logoUrl={company?.logo_url} />
      {!collapsed && (
        <span
          className="truncate text-lg font-semibold tracking-tight"
          title={name}
        >
          {name}
        </span>
      )}
    </div>
  );
}

// Name on hover, only in the icon rail
function RailTip({
  label,
  show,
  children,
}: {
  label: string;
  show?: boolean;
  children: React.ReactElement;
}) {
  if (!show) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function Item({
  link,
  nested,
  collapsed,
  onNavigate,
}: NavProps & { link: NavLink; nested?: boolean }) {
  const pathname = usePathname();
  const active = isActive(pathname, link);
  const Icon = link.icon;
  return (
    <RailTip label={link.label} show={collapsed}>
      <Link
        href={link.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? link.label : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg text-sm transition-colors",
          collapsed
            ? "size-10 justify-center self-center"
            : nested
              ? "py-2 pr-3 pl-9"
              : "px-3 py-2",
          active
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        {active && (
          <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-primary" />
        )}
        <Icon
          className={cn(
            nested && !collapsed ? "size-3.5" : "size-4",
            active
              ? "text-primary"
              : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground",
          )}
        />
        {!collapsed && link.label}
      </Link>
    </RailTip>
  );
}

// Icon rail: a group is one icon whose pages open in a menu to the right
function RailGroup({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const childActive = group.children.some((c) => isActive(pathname, c));
  const Icon = group.icon;
  return (
    <DropdownMenu>
      <RailTip label={group.label} show>
        <DropdownMenuTrigger
          aria-label={group.label}
          className={cn(
            "relative flex size-10 items-center justify-center self-center rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            childActive
              ? "bg-sidebar-accent text-primary"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          )}
        >
          {childActive && (
            <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-primary" />
          )}
          <Icon className="size-4" />
        </DropdownMenuTrigger>
      </RailTip>
      <DropdownMenuContent side="right" align="start" className="w-56">
        <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {group.children.map((c) => {
          const ChildIcon = c.icon;
          return (
            <DropdownMenuItem key={c.href} asChild>
              <Link
                href={c.href}
                aria-current={isActive(pathname, c) ? "page" : undefined}
                className={cn(
                  isActive(pathname, c) && "font-medium text-primary",
                )}
              >
                <ChildIcon /> {c.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Group({
  group,
  onNavigate,
  forceOpen,
}: {
  group: NavGroup;
  onNavigate?: () => void;
  forceOpen?: boolean;
}) {
  const pathname = usePathname();
  const childActive = group.children.some((c) => isActive(pathname, c));
  const [open, setOpen] = useState(childActive);
  const Icon = group.icon;

  return (
    <Collapsible
      open={open || childActive || Boolean(forceOpen)}
      onOpenChange={setOpen}
    >
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          childActive
            ? "font-medium text-sidebar-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        <Icon
          className={cn(
            "size-4",
            childActive ? "text-primary" : "text-sidebar-foreground/60",
          )}
        />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={cn(
            "size-4 transition-transform",
            (open || childActive || forceOpen) && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="relative mt-0.5 flex flex-col gap-0.5 before:absolute before:top-1 before:bottom-1 before:left-[1.4rem] before:w-px before:bg-sidebar-border">
        {group.children.map((c) => (
          <Item key={c.href} link={c} nested onNavigate={onNavigate} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Menu items whose name (or group name) matches the search
function filterNav(nav: NavItem[], q: string): NavItem[] {
  const t = q.trim().toLowerCase();
  if (!t) return nav;
  const hit = (label: string) => label.toLowerCase().includes(t);
  return nav.flatMap((item): NavItem[] => {
    if (!isGroup(item)) return hit(item.label) ? [item] : [];
    const kids = hit(item.label)
      ? item.children
      : item.children.filter((c) => hit(c.label));
    return kids.length ? [{ ...item, children: kids }] : [];
  });
}

// "Menu" heading with a search button that turns into a box filtering the menu
function MenuSearch({
  query,
  setQuery,
  onPick,
}: {
  query: string | null;
  setQuery: (q: string | null) => void;
  onPick: () => void;
}) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (query !== null) box.current?.focus();
  }, [query]);
  if (query === null) {
    return (
      <div className="flex items-center justify-between px-5 pt-4 pb-1.5">
        <span className="text-2xs font-semibold tracking-[0.14em] text-sidebar-foreground/45 uppercase">
          Menu
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Search the menu"
              className="flex size-7 items-center justify-center rounded-md text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Search className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Search the menu · Ctrl K for everything
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }
  return (
    <div className="px-3 pt-3 pb-1.5">
      <div className="flex h-9 items-center gap-2 rounded-lg border border-sidebar-border bg-background px-2.5 focus-within:ring-2 focus-within:ring-ring/40">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={box}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery(null);
            if (e.key === "Enter") onPick();
          }}
          placeholder="Search menu…"
          aria-label="Search the menu"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={() => setQuery(null)}
          aria-label="Close search"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// The menu itself — used by the desktop sidebar (open or icon rail) and the mobile sheet
export function SidebarNav({ collapsed, onNavigate }: NavProps) {
  const router = useRouter();
  const pages = useAuthStore((s) => s.pages);
  const teamSize = useAuthStore((s) => s.user?.team_size ?? 0);
  const openPalette = useCommandStore((s) => s.setPalette);
  const [query, setQuery] = useState<string | null>(null); // null = search closed
  // "My Team" only for people someone reports to
  const nav = buildNav(
    teamSize ? pages : pages.filter((p) => p.slug !== "my-team"),
  );
  const searching = !collapsed && Boolean(query?.trim());
  const shown = searching ? filterNav(nav, query!) : nav;

  // Enter in the search box opens the first match
  const pickFirst = () => {
    const first = shown[0];
    const link = first ? (isGroup(first) ? first.children[0] : first) : null;
    if (!link) return;
    setQuery(null);
    onNavigate?.();
    router.push(link.href);
  };

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Brand collapsed={collapsed} />
      {!collapsed && (
        <MenuSearch query={query} setQuery={setQuery} onPick={pickFirst} />
      )}
      <nav
        className={cn(
          "flex flex-1 flex-col gap-0.5 overflow-y-auto pb-4",
          collapsed ? "items-stretch px-2 pt-4" : "px-3",
        )}
        aria-label="Main"
      >
        {collapsed && (
          <RailTip label="Search (Ctrl K)" show>
            <button
              type="button"
              onClick={() => openPalette(true)}
              aria-label="Search"
              className="mb-1 flex size-10 items-center justify-center self-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Search className="size-4" />
            </button>
          </RailTip>
        )}
        {searching && shown.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-sidebar-foreground/55">
            No page matches “{query}”
          </p>
        )}
        {shown.map((item) =>
          isGroup(item) ? (
            collapsed ? (
              <RailGroup key={item.key} group={item} />
            ) : (
              <Group
                key={item.key}
                group={item}
                onNavigate={onNavigate}
                forceOpen={searching}
              />
            )
          ) : (
            <Item
              key={item.href}
              link={item}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ),
        )}
      </nav>
    </div>
  );
}

// Desktop sidebar: open (icons + names) or collapsed (icon rail), toggled by the edge button
export function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);

  useEffect(() => {
    useSidebarStore.persist.rehydrate();
  }, []);

  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border transition-[width] duration-200 lg:block",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <SidebarNav collapsed={collapsed} />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="absolute top-[4.25rem] -right-3 z-10 flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Icon className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {collapsed ? "Expand sidebar" : "Collapse sidebar"}
        </TooltipContent>
      </Tooltip>
    </aside>
  );
}
