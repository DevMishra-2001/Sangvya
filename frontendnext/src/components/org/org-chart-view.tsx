"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, Crown, Layers, Network, Search, UserRound, Users, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { FormHeading } from "@/components/common/form-layout";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { PersonAvatar } from "@/components/common/person-avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { fmtDate } from "@/lib/format";
import { canVisit } from "@/lib/permissions";
import { orgService, type OrgMember, type OrgNode, type OrgOverview, type Paged } from "@/lib/services/org";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { pageUrls } from "@/components/layout/nav-items";

// Department tiles cycle through these accents
const TONES = ["bg-sky-500/12 text-sky-600 dark:text-sky-400", "bg-violet-500/12 text-violet-600 dark:text-violet-400", "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400", "bg-amber-500/15 text-amber-600 dark:text-amber-400", "bg-rose-500/12 text-rose-600 dark:text-rose-400", "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400"];

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

// A person in the tree; with reports it opens to load them
function PersonChip({ node, highlight, canOpenProfile }: { node: OrgNode; highlight?: boolean; canOpenProfile: boolean }) {
  const body = (
    <span className={cn("flex min-w-0 items-center gap-2.5 rounded-lg border bg-card px-2.5 py-1.5", highlight && "border-primary bg-primary/5 ring-2 ring-primary/20")}>
      <PersonAvatar name={node.name} photoUrl={node.photo_url} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{node.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{[node.designation, node.department].filter(Boolean).join(" · ") || "—"}</span>
      </span>
    </span>
  );
  return canOpenProfile ? (
    <Link href={`/employees/${node.id}`} className="min-w-0 hover:[&>span]:border-primary/60">
      {body}
    </Link>
  ) : (
    body
  );
}

function TreeNode({ node, canOpenProfile, depth = 0 }: { node: OrgNode; canOpenProfile: boolean; depth?: number }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<OrgNode[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !children) {
      setLoading(true);
      const r = await run(() => orgService.reports(node.id));
      setLoading(false);
      setChildren(r.ok ? r.data : []);
    }
  }

  return (
    <li className="relative">
      <div className="flex items-center gap-1.5">
        {node.report_count > 0 ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} ${node.name}'s team`}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {loading ? <Spinner className="size-3.5" /> : <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />}
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        <PersonChip node={node} canOpenProfile={canOpenProfile} />
        {node.report_count > 0 && (
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {node.report_count}
          </Badge>
        )}
      </div>
      {open && children && children.length > 0 && (
        <ul className="mt-1.5 ml-3 flex flex-col gap-1.5 border-l border-dashed pl-4">
          {children.map((c) => (
            <TreeNode key={c.id} node={c} canOpenProfile={canOpenProfile} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Managers above me, me, and my team
function MyPlace({ me, canOpenProfile }: { me: NonNullable<OrgOverview["me"]>; canOpenProfile: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4">
      {me.managers.map((m) => (
        <div key={m.id} className="flex w-full max-w-xs flex-col items-center gap-2">
          <PersonChip node={m} canOpenProfile={canOpenProfile} />
          <span className="h-4 w-px bg-border" aria-hidden />
        </div>
      ))}
      <div className="w-full max-w-xs">
        <PersonChip node={me.self} highlight canOpenProfile={canOpenProfile} />
      </div>
      {me.reports.length > 0 ? (
        <>
          <span className="h-4 w-px bg-border" aria-hidden />
          <p className="text-xs font-medium text-muted-foreground">Reports to you · {me.reports.length}</p>
          <div className="grid w-full gap-2 sm:grid-cols-2">
            {me.reports.map((r) => (
              <PersonChip key={r.id} node={r} canOpenProfile={canOpenProfile} />
            ))}
          </div>
        </>
      ) : (
        <p className="pt-2 text-xs text-muted-foreground">Nobody reports to you.</p>
      )}
    </div>
  );
}

// A department's people, paged on the server (?department=&page=&limit=&search=)
function DepartmentMembers({ department, canOpenProfile }: { department: string; canOpenProfile: boolean }) {
  const router = useRouter();
  const url = useUrlParams();
  const page = url.getNumber("page", 1);
  const limit = url.getNumber("limit", 10);
  const search = url.get("search");
  const [typed, setTyped] = useState(search);
  const [data, setData] = useState<({ department: { name: string }; members: OrgMember[] } & Paged) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    run(() => orgService.members(department === "none" ? "none" : Number(department), { page, limit, search: search || undefined })).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setData(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [department, page, limit, search]);

  useEffect(() => {
    const t = setTimeout(() => typed.trim() !== search && url.set({ search: typed.trim(), page: null }), 350);
    return () => clearTimeout(t);
  }, [typed, search, url]);

  return (
    <section id="department-members" className="overflow-hidden rounded-xl border bg-card">
      <FormHeading
        title={data ? `${data.department.name} · ${data.total} ${data.total === 1 ? "person" : "people"}` : "Loading…"}
        icon={Users}
        actions={
          <div className="relative w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search this team…" value={typed} onChange={(e) => setTyped(e.target.value)} className="h-8 pl-8" aria-label="Search this department" />
          </div>
        }
      />
      {!data ? (
        <Skeleton className="m-4 h-40 rounded-lg" />
      ) : (
        <>
          <div className={cn("overflow-x-auto transition-opacity", loading && "opacity-60")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Reports to</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-24 text-right">Team</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.members.map((m) => (
                  <TableRow key={m.id} className={cn(canOpenProfile && "cursor-pointer")} onClick={() => canOpenProfile && router.push(`/employees/${m.id}`)}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2.5">
                        <PersonAvatar name={m.name} photoUrl={m.photo_url} />
                        {m.name}
                        {m.status === "notice" && <Badge variant="outline">On notice</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.employee_code || "—"}</TableCell>
                    <TableCell>{m.designation || "—"}</TableCell>
                    <TableCell>{m.manager_name || "—"}</TableCell>
                    <TableCell>{m.branch || "—"}</TableCell>
                    <TableCell>{fmtDate(m.join_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.report_count || "—"}</TableCell>
                  </TableRow>
                ))}
                {data.members.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nobody here{search ? " matches that search" : " yet"}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination
            className="border-t"
            page={data.page}
            limit={data.limit}
            total={data.total}
            onPageChange={(p) => url.set({ page: p === 1 ? null : p })}
            onLimitChange={(l) => url.set({ limit: l === 10 ? null : l, page: null })}
          />
        </>
      )}
    </section>
  );
}

// Org chart: who leads whom, where I sit, and each department's people
export function OrgChartView() {
  const pages = useAuthStore((s) => s.pages);
  const canOpenProfile = canVisit(pageUrls(pages), "/employees/1");
  const url = useUrlParams();
  const department = url.get("department");
  const [data, setData] = useState<OrgOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    run(orgService.overview).then((r) => !cancelled && r.ok && setData(r.data));
    return () => {
      cancelled = true;
    };
  }, []);

  function pickDepartment(id: number | null) {
    const key = id === null ? "none" : String(id);
    url.set({ department: department === key ? null : key, page: null, search: null });
    if (department !== key) setTimeout(() => document.getElementById("department-members")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading org chart">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Org Chart" description="Who leads whom, where you sit, and the people in each department." className="mb-0" />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={Users} value={data.stats.total} label="People" />
        <Stat icon={Building2} value={data.stats.departments} label="Departments" />
        <Stat icon={Crown} value={data.stats.leaders} label="Lead a team" />
        <Stat icon={Layers} value={data.stats.levels} label="Levels deep" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="overflow-hidden rounded-xl border bg-card lg:col-span-2">
          <FormHeading title="Your place" icon={UserRound} />
          {data.me ? <MyPlace me={data.me} canOpenProfile={canOpenProfile} /> : <p className="p-6 text-sm text-muted-foreground">Your login isn&apos;t linked to an employee.</p>}
        </section>

        <section className="overflow-hidden rounded-xl border bg-card lg:col-span-3">
          <FormHeading title="Reporting tree" icon={Network} actions={<span className="text-xs text-muted-foreground">Open a person to see their team</span>} />
          {data.roots.length === 0 ? (
            <EmptyState icon={Network} title="No reporting lines yet" description='Set "Reports to" on employees to build the tree.' />
          ) : (
            <ul className="flex max-h-[520px] flex-col gap-1.5 overflow-y-auto p-4">
              {data.roots.map((n) => (
                <TreeNode key={n.id} node={n} canOpenProfile={canOpenProfile} />
              ))}
            </ul>
          )}
          {data.unassigned > 0 && (
            <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
              {data.unassigned} {data.unassigned === 1 ? "person has" : "people have"} no manager and no team — set &quot;Reports to&quot; to place them.
            </p>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading title="Departments" icon={Building2} actions={<span className="text-xs text-muted-foreground">Pick one to see its people</span>} />
        {data.departments.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No departments yet.</p>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {data.departments.map((d, i) => {
              const key = d.id === null ? "none" : String(d.id);
              const selected = department === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pickDepartment(d.id)}
                  aria-pressed={selected}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm",
                    selected && "border-primary bg-primary/5 ring-2 ring-primary/20",
                  )}
                >
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONES[i % TONES.length])}>
                    <Users className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{d.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {d.count} {d.count === 1 ? "person" : "people"}
                    </span>
                  </span>
                  <ChevronRight className={cn("size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5", selected && "rotate-90 text-primary")} />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {department && <DepartmentMembers key={department} department={department} canOpenProfile={canOpenProfile} />}
    </div>
  );
}
