// The sidebar menu, built from the pages the user can open (Page Master,
// loaded once with login / GET /auth/me).
import type { LucideIcon } from "lucide-react";
import { pageIcon } from "@/lib/page-icons";
import type { AppPage } from "@/lib/types";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  children: NavLink[];
}

export type NavItem = NavLink | NavGroup;

export const isGroup = (item: NavItem): item is NavGroup => "children" in item;

export function isActive(pathname: string, link: NavLink) {
  return link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
}

const bySort = (a: AppPage, b: AppPage) => a.sort_order - b.sort_order || a.id - b.id;

function toLink(p: AppPage, siblings: AppPage[]): NavLink {
  const url = p.url!;
  // Exact match when another menu page lives under this URL (/my-attendance vs /my-attendance/calendar)
  const exact = url === "/" || siblings.some((s) => s.id !== p.id && s.url?.startsWith(`${url}/`));
  return { href: url, label: p.name, icon: pageIcon(p.icon), exact };
}

// Pages → menu: top-level pages in order; a page without a URL is a group of its children
export function buildNav(pages: AppPage[]): NavItem[] {
  const menu = pages.filter((p) => p.show_in_menu);
  const children = (id: number) => menu.filter((p) => p.parent_id === id && p.url).sort(bySort);
  return menu
    .filter((p) => !p.parent_id || !menu.some((m) => m.id === p.parent_id))
    .sort(bySort)
    .flatMap((p): NavItem[] => {
      if (p.url) return [toLink(p, menu)];
      const kids = children(p.id);
      return kids.length ? [{ key: p.slug, label: p.name, icon: pageIcon(p.icon), children: kids.map((k) => toLink(k, menu)) }] : [];
    });
}

// URLs of every page the user can open (menu or not) — used by the page guard
export const pageUrls = (pages: AppPage[]) => pages.map((p) => p.url).filter((u): u is string => Boolean(u));
