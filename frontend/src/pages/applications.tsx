import {
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  FilePlus2,
  FolderSearch,
  Loader2,
  Paperclip,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { EmptyState, PageHeader } from "@/components/page";
import { StatusBadge, statusLabel } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadFile, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { useApplications, useDeleteApplication, useMeta } from "@/lib/queries";
import type { ApplicationListItem, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "received", label: "Received" },
  { value: "queried", label: "Queried" },
  { value: "committee", label: "Committee" },
  { value: "board", label: "Board" },
  { value: "minister", label: "Minister" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function ApplicationsPage({ queue = false }: { queue?: boolean }) {
  const { user, hasRole } = useAuth();
  const { data: meta } = useMeta();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter = queue ? "" : (searchParams.get("status") ?? "");
  const preferredProvince = searchParams.get("preferred_province") ?? "";
  const farmType = searchParams.get("farm_type") ?? "";
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const [deleteTarget, setDeleteTarget] = useState<ApplicationListItem | null>(null);
  const deleteApp = useDeleteApplication();
  const q = searchParams.get("q") ?? "";

  function canModifyRow(item: ApplicationListItem) {
    if (user?.role === "admin") return true;
    if (user?.role === "capture_officer" || user?.role === "land_officer") {
      return item.status === "received" || item.status === "queried";
    }
    return false;
  }

  const queryParams: Record<string, unknown> = {
    page,
    ...(queue ? { queue: "mine" } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(preferredProvince ? { preferred_province: preferredProvince } : {}),
    ...(farmType ? { farm_type: farmType } : {}),
    ...(q ? { q } : {}),
  };

  const { data, isLoading } = useApplications(queryParams);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setSearchParams(next);
  }

  function clearFilters() {
    setSearchInput("");
    setSearchParams({});
  }

  async function handleExport() {
    try {
      const qs = new URLSearchParams();
      if (queue) qs.set("queue", "mine");
      if (statusFilter) qs.set("status", statusFilter);
      if (preferredProvince) qs.set("preferred_province", preferredProvince);
      if (farmType) qs.set("farm_type", farmType);
      if (q) qs.set("q", q);
      const query = qs.toString() ? `?${qs.toString()}` : "";
      await downloadFile(`/applications/export/${query}`, "land-applications.csv");
    } catch (err) {
      toast.error(errorMessage(err, "Export failed"));
    }
  }

  const hasActiveFilters = Boolean(statusFilter || preferredProvince || farmType || q);
  const totalPages = data ? Math.max(1, Math.ceil(data.count / 20)) : 1;

  return (
    <div>
      <PageHeader
        eyebrow={queue ? `Action Queue · ${user?.role_display}` : "Model A2 Commercial Farm Settlement Scheme"}
        title={queue ? "My Decision Queue" : "Applications Register"}
        description={
          queue
            ? "Applications currently at your stage of the statutory approval workflow."
            : "Search, filter and track online and physical applications acrossSections A–G."
        }
        actions={
          <>
            <Button variant="outline" onClick={handleExport}>
              <Download /> Export CSV
            </Button>
            {hasRole("capture_officer", "land_officer") && (
              <Button asChild>
                <Link to="/applications/new">
                  <FilePlus2 /> Capture application
                </Link>
              </Button>
            )}
          </>
        }
      />

      {!queue && (
        <div className="mb-4 flex flex-wrap items-center gap-1 border-b pb-2.5">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => updateParam("status", tab.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Search & filters bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateParam("q", searchInput.trim());
          }}
          className="relative min-w-[240px] flex-1 sm:max-w-sm"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search Form No., surname, National ID, district..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </form>

        <div className="w-48">
          <Select
            value={preferredProvince || "__all__"}
            onValueChange={(v) => updateParam("preferred_province", v === "__all__" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Preferred province" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All preferred provinces</SelectItem>
              {meta?.provinces.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <Select
            value={farmType || "__all__"}
            onValueChange={(v) => updateParam("farm_type", v === "__all__" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Farm scale" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All farm scales</SelectItem>
              {meta?.farm_types.map((ft) => (
                <SelectItem key={ft.value} value={ft.value}>
                  {ft.label.replace(" Commercial Settlement", "")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X /> Clear filters
          </Button>
        )}
      </div>

      <Card>
        {isLoading ? (
          <div className="grid gap-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : !data || data.results.length === 0 ? (
          <EmptyState
            icon={<FolderSearch />}
            title={queue ? "No applications waiting in your queue" : "No matching applications"}
            description={
              hasActiveFilters
                ? `No records matched your current filters${statusFilter ? ` (${statusLabel(statusFilter as Status)})` : ""}.`
                : "Captured applications will appear here."
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Reset filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form No.</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>National ID</TableHead>
                  <TableHead>Preferred Area</TableHead>
                  <TableHead>Scheme Scale & Farming</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((item) => (
                  <TableRow
                    key={item.reference}
                    onClick={() => navigate(`/applications/${item.reference}`)}
                    className="cursor-pointer"
                  >
                    <TableCell className="ref font-medium text-primary">
                      {item.application_no}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {item.surname}, {item.other_names}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground capitalize">
                        {item.title}. · {item.sex}
                      </div>
                    </TableCell>
                    <TableCell className="ref text-muted-foreground">{item.national_id}</TableCell>
                    <TableCell>
                      <div>{item.preferred_district}</div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {item.preferred_province_display}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{item.farm_type_display.replace(" Commercial Settlement", "")}</div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {item.farming_type_display}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 font-mono text-[12px] text-muted-foreground">
                        <Paperclip className="size-3.5" />
                        {item.attachment_count}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(item.date_received)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canModifyRow(item) && (
                        <div className="inline-flex items-center gap-1">
                          <Button
                            asChild
                            variant="ghost"
                            size="icon-sm"
                            title="Edit particulars"
                          >
                            <Link to={`/applications/${item.reference}/edit`}>
                              <Edit3 className="size-3.5" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Delete application"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t px-5 py-3 text-[12.5px] text-muted-foreground">
              <span>
                Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.count)} of{" "}
                <strong className="font-medium text-foreground">{data.count}</strong> applications
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.previous}
                  onClick={() => updateParam("page", String(page - 1))}
                >
                  <ChevronLeft /> Previous
                </Button>
                <span className="px-2 font-mono text-[12px]">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.next}
                  onClick={() => updateParam("page", String(page + 1))}
                >
                  Next <ChevronRight />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Application {deleteTarget?.application_no}?</DialogTitle>
            <DialogDescription>
              This permanently removes {deleteTarget?.full_name}&apos;s application along with its
              reviews, activity logs, notifications, and uploaded attachments. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteApp.isPending}
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteApp.mutateAsync(deleteTarget.reference);
                  toast.success(`Application ${deleteTarget.application_no} deleted.`);
                  setDeleteTarget(null);
                } catch (err) {
                  toast.error(errorMessage(err, "Could not delete application."));
                }
              }}
            >
              {deleteApp.isPending && <Loader2 className="animate-spin" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

