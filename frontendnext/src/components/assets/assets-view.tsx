"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Archive, CircleCheck, History, IndianRupee, Laptop, MoreHorizontal, Pencil, Plus, Search, Trash2, Undo2, UserPlus, Wrench } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { SelectField } from "@/components/common/select-field";
import { StatTile } from "@/components/common/stat-tile";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { fmtDate, inr } from "@/lib/format";
import { ASSET_CATEGORY_LABELS, ASSET_CONDITION_LABELS, ASSET_STATUS_LABELS, assetsService, type Asset, type AssetStatus } from "@/lib/services/assets";
import { cn } from "@/lib/utils";
import { AssetFormDialog, AssignDialog, CATEGORY_OPTIONS, HistoryDialog, ReturnDialog } from "./asset-dialogs";

type Data = Awaited<ReturnType<typeof assetsService.list>>;
const STATUS_TONE: Record<AssetStatus, "success" | "info" | "warning" | "neutral" | "danger"> = {
  available: "success",
  assigned: "info",
  in_repair: "warning",
  retired: "neutral",
  lost: "danger",
};

// Company assets: add them, give them to people, take them back
export function AssetsView() {
  const url = useUrlParams();
  const page = url.getNumber("page", 1);
  const limit = url.getNumber("limit", 20);
  const status = url.get("status");
  const category = url.get("category");
  const search = url.get("search");
  const [typed, setTyped] = useState(search);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [assigning, setAssigning] = useState<Asset | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [returning, setReturning] = useState<Asset | null>(null);
  const [history, setHistory] = useState<Asset | null>(null);

  const params = {
    page,
    limit,
    status: status || undefined,
    category: category || undefined,
    search: search || undefined,
  };
  const load = useCallback(async () => {
    setLoading(true);
    const r = await run(() =>
      assetsService.list({
        page,
        limit,
        status: status || undefined,
        category: category || undefined,
        search: search || undefined,
      }),
    );
    setLoading(false);
    if (r.ok) setData(r.data);
  }, [page, limit, status, category, search]);

  useEffect(() => {
    let cancelled = false;
    run(() => assetsService.list(params)).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setData(r.data);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- params are built from these
  }, [page, limit, status, category, search]);

  useEffect(() => {
    const t = setTimeout(() => typed.trim() !== search && url.set({ search: typed.trim(), page: null }), 350);
    return () => clearTimeout(t);
  }, [typed, search, url]);

  async function act(fn: () => Promise<unknown>, success: string) {
    if ((await run(fn, { success })).ok) load();
  }

  const s = data?.stats;
  const filterStatus = (v: string) => url.set({ status: status === v ? null : v, page: null });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Assets"
        description="Laptops, phones, ID cards and more — who has what, and everything that came back."
        className="mb-0"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setAssigning(null);
                setAssignOpen(true);
              }}
            >
              <UserPlus /> Assign assets
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> Add asset
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile icon={Laptop} value={s?.total ?? "—"} label="All assets" active={!status} onClick={() => url.set({ status: null, page: null })} />
        <StatTile
          icon={CircleCheck}
          value={s?.available ?? 0}
          label="Available"
          tone="bg-success/15 text-success"
          active={status === "available"}
          onClick={() => filterStatus("available")}
        />
        <StatTile
          icon={UserPlus}
          value={s?.assigned ?? 0}
          label="With employees"
          tone="bg-info/15 text-info"
          active={status === "assigned"}
          onClick={() => filterStatus("assigned")}
        />
        <StatTile
          icon={Wrench}
          value={s?.in_repair ?? 0}
          label="In repair"
          tone="bg-warning/15 text-warning"
          active={status === "in_repair"}
          onClick={() => filterStatus("in_repair")}
        />
        <StatTile icon={IndianRupee} value={s ? inr(s.value) : "—"} label="Asset value" tone="bg-violet-500/12 text-violet-600 dark:text-violet-400" />
      </div>

      {!data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : data.stats.total === 0 ? (
        <EmptyState icon={Laptop} title="No assets yet" description="Add your laptops, phones and cards first — then assign them to employees." />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-wrap gap-2 border-b p-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Code, name, serial or holder…" value={typed} onChange={(e) => setTyped(e.target.value)} className="pl-8" aria-label="Search assets" />
            </div>
            <SelectField
              className="w-44"
              value={category}
              onValueChange={(v) => url.set({ category: v || null, page: null })}
              emptyLabel="All categories"
              options={CATEGORY_OPTIONS}
              aria-label="Category"
            />
            <SelectField
              className="w-40"
              value={status}
              onValueChange={(v) => url.set({ status: v || null, page: null })}
              emptyLabel="Any status"
              options={(Object.entries(ASSET_STATUS_LABELS) as [AssetStatus, string][]).map(([value, label]) => ({ value, label }))}
              aria-label="Status"
            />
          </div>
          <div className={cn("overflow-x-auto transition-opacity", loading && "opacity-60")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Serial no.</TableHead>
                  <TableHead>With</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Warranty</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.assets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{a.asset_code}</span>
                      <span className="block font-medium">{a.name}</span>
                      {(a.brand || a.model) && <span className="block text-xs text-muted-foreground">{[a.brand, a.model].filter(Boolean).join(" ")}</span>}
                    </TableCell>
                    <TableCell>{ASSET_CATEGORY_LABELS[a.category]}</TableCell>
                    <TableCell className="font-mono text-xs">{a.serial_number || "—"}</TableCell>
                    <TableCell>
                      {a.holder_id ? (
                        <Link href={`/employees/${a.holder_id}`} className="hover:text-primary hover:underline">
                          {a.holder_name}
                          <span className="block text-xs text-muted-foreground">since {fmtDate(a.held_since)}</span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{a.branch ?? "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={STATUS_TONE[a.status]}>{ASSET_STATUS_LABELS[a.status]}</StatusBadge>
                    </TableCell>
                    <TableCell className={cn(a.condition === "damaged" && "text-destructive")}>{ASSET_CONDITION_LABELS[a.condition]}</TableCell>
                    <TableCell className={cn("text-xs", a.warranty_until && a.warranty_until < new Date().toISOString().slice(0, 10) && "text-muted-foreground line-through")}>
                      {a.warranty_until ? fmtDate(a.warranty_until) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {a.status === "available" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAssigning(a);
                              setAssignOpen(true);
                            }}
                          >
                            <UserPlus /> Assign
                          </Button>
                        )}
                        {a.status === "assigned" && (
                          <Button size="sm" variant="outline" onClick={() => setReturning(a)}>
                            <Undo2 /> Return
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`More for ${a.asset_code}`}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onSelect={() => {
                                setEditing(a);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setHistory(a)}>
                              <History /> History
                            </DropdownMenuItem>
                            {a.status !== "assigned" && (
                              <>
                                <DropdownMenuSeparator />
                                {a.status !== "available" && (
                                  <DropdownMenuItem onSelect={() => act(() => assetsService.setStatus(a.id, "available"), `${a.asset_code} is available`)}>
                                    <CircleCheck /> Mark available
                                  </DropdownMenuItem>
                                )}
                                {a.status !== "in_repair" && (
                                  <DropdownMenuItem onSelect={() => act(() => assetsService.setStatus(a.id, "in_repair"), `${a.asset_code} sent for repair`)}>
                                    <Wrench /> Send for repair
                                  </DropdownMenuItem>
                                )}
                                {a.status !== "retired" && (
                                  <DropdownMenuItem onSelect={() => act(() => assetsService.setStatus(a.id, "retired"), `${a.asset_code} retired`)}>
                                    <Archive /> Retire
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() =>
                                    window.confirm(`Delete ${a.asset_code} and its history? This can't be undone.`) && act(() => assetsService.remove(a.id), "Asset deleted")
                                  }
                                >
                                  <Trash2 /> Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {data.assets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No assets match these filters.
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
            onLimitChange={(l) => url.set({ limit: l === 20 ? null : l, page: null })}
          />
        </Card>
      )}

      <AssetFormDialog open={formOpen} onOpenChange={setFormOpen} asset={editing} onSaved={load} />
      <AssignDialog open={assignOpen} asset={assigning} onClose={() => setAssignOpen(false)} onDone={load} />
      <ReturnDialog asset={returning} onClose={() => setReturning(null)} onDone={load} />
      <HistoryDialog asset={history} onClose={() => setHistory(null)} />
    </div>
  );
}
