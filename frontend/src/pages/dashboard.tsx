import { format, parseISO } from "date-fns";
import { AlertTriangle, ArrowUpRight, FilePlus2, FileWarning, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/page";
import { statusDot, statusLabel } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { useLabel, useStats } from "@/lib/queries";
import type { Status } from "@/lib/types";
import { cn } from "@/lib/utils";

const PIPELINE: Status[] = ["received", "queried", "committee", "board", "minister", "approved", "rejected", "withdrawn"];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[26px] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1.5 text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const { data, isLoading } = useStats();
  const label = useLabel();

  if (isLoading || !data) {
    return (
      <div className="grid gap-5">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-24" />
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const pipelineTotal = PIPELINE.reduce((sum, s) => sum + (data.by_status[s] ?? 0), 0) || 1;
  const maxFarm = Math.max(1, ...data.by_farm_type.map((f) => f.n));
  const maxProvince = Math.max(1, ...data.by_province.map((p) => p.n));
  const monthly = data.monthly.map((m) => ({ ...m, label: format(parseISO(`${m.month}-01`), "MMM") }));
  const showQueue = user?.role !== "admin" && user?.role !== "capture_officer";

  return (
    <div>
      <PageHeader
        eyebrow={format(new Date(), "EEEE, d MMMM yyyy")}
        title={`${greeting()}, ${user?.first_name || user?.username}`}
        description="Head Office · Land Reform and Resettlement Programme (Phase II, Model A2)"
        actions={
          hasRole("capture_officer", "land_officer") && (
            <Button asChild>
              <Link to="/applications/new">
                <FilePlus2 /> Capture application
              </Link>
            </Button>
          )
        }
      />

      {showQueue && data.my_queue > 0 && (
        <Link
          to="/queue"
          className="mb-5 flex items-center gap-3 rounded-lg border border-gold/40 bg-gold-soft/50 px-4 py-3 transition-colors hover:bg-gold-soft"
        >
          <Inbox className="size-4 text-[#7a5410]" />
          <p className="flex-1 text-[13px]">
            <span className="font-semibold">{data.my_queue}</span> application{data.my_queue === 1 ? " is" : "s are"} waiting
            for your decision as {user?.role_display}.
          </p>
          <ArrowUpRight className="size-4 text-[#7a5410]" />
        </Link>
      )}

      <Card className="grid grid-cols-2 divide-x divide-y md:grid-cols-4 md:divide-y-0">
        <Metric label="Total applications" value={data.total.toLocaleString()} />
        <Metric label="Open files" value={data.open.toLocaleString()} hint="Not yet finalised" />
        <Metric label="Received this month" value={data.this_month.toLocaleString()} />
        <Metric
          label="Average time to decision"
          value={data.avg_decision_days != null ? `${data.avg_decision_days}d` : "—"}
          hint="Capture to final outcome"
        />
      </Card>

      {/* Pipeline */}
      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Where applications are</CardTitle>
          <Link to="/applications" className="text-[12.5px] text-muted-foreground hover:text-foreground">
            View register →
          </Link>
        </CardHeader>
        <CardContent>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            {PIPELINE.map((s) => {
              const n = data.by_status[s] ?? 0;
              if (!n) return null;
              return <div key={s} className={cn("h-full", statusDot(s))} style={{ width: `${(n / pipelineTotal) * 100}%` }} />;
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
            {PIPELINE.map((s) => (
              <Link
                key={s}
                to={`/applications?status=${s}`}
                className="group flex items-center justify-between gap-2 rounded px-1 py-0.5 hover:bg-muted/60"
              >
                <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground group-hover:text-foreground">
                  <span className={cn("size-2 rounded-sm", statusDot(s))} />
                  {statusLabel(s)}
                </span>
                <span className="font-mono text-[12.5px] tabular-nums">{data.by_status[s] ?? 0}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Received vs approved, last 12 months</CardTitle>
            <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-[#c9c2ae]" /> Received
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-forest-700" /> Approved
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-64 pl-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} barGap={2} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: "var(--muted-foreground)" }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    fontSize: 12,
                    boxShadow: "0 4px 14px rgba(0,0,0,.06)",
                  }}
                />
                <Bar dataKey="received" name="Received" fill="#c9c2ae" radius={[2, 2, 0, 0]} maxBarSize={18} />
                <Bar dataKey="approved" name="Approved" fill="var(--forest-700)" radius={[2, 2, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Farm type requested</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3.5">
            {data.by_farm_type.length === 0 && <p className="text-[13px] text-muted-foreground">No data yet.</p>}
            {data.by_farm_type.map((f) => (
              <div key={f.farm_type}>
                <div className="flex justify-between text-[12.5px]">
                  <span>{label("farm_types", f.farm_type).replace(" Commercial Settlement", "")}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{f.n}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${(f.n / maxFarm) * 100}%` }} />
                </div>
              </div>
            ))}

            <div className="mt-2 border-t pt-4">
              <p className="eyebrow mb-2.5">Applicants by sex</p>
              <div className="flex gap-6 text-[13px]">
                <div>
                  <span className="text-[20px] font-semibold tabular-nums">{data.by_sex.female ?? 0}</span>
                  <span className="ml-1.5 text-muted-foreground">women</span>
                </div>
                <div>
                  <span className="text-[20px] font-semibold tabular-nums">{data.by_sex.male ?? 0}</span>
                  <span className="ml-1.5 text-muted-foreground">men</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <ul className="divide-y">
            {data.recent.length === 0 && <li className="px-5 py-6 text-[13px] text-muted-foreground">Nothing yet.</li>}
            {data.recent.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/applications/${a.application_reference}`}
                  className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                >
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", a.to_status ? statusDot(a.to_status as Status) : "bg-border")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]">
                      <span className="font-medium">{a.actor.full_name}</span>{" "}
                      <span className="text-muted-foreground">{a.verb_display.toLowerCase()}</span>{" "}
                      {a.message && <span className="text-muted-foreground">— {a.message}</span>}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      <span className="ref text-[12px] text-foreground/80">{a.application_no}</span> · {a.applicant}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11.5px] text-muted-foreground">{timeAgo(a.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="grid content-start gap-5">
          {(data.stale > 0 || data.missing_id > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Needs attention</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {data.stale > 0 && (
                  <div className="flex items-start gap-2.5 text-[13px]">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" />
                    <p>
                      <span className="font-semibold">{data.stale}</span> open file{data.stale === 1 ? " has" : "s have"} not
                      moved in over 30 days.
                    </p>
                  </div>
                )}
                {data.missing_id > 0 && (
                  <div className="flex items-start gap-2.5 text-[13px]">
                    <FileWarning className="mt-0.5 size-4 shrink-0 text-earth" />
                    <p>
                      <span className="font-semibold">{data.missing_id}</span> pending application
                      {data.missing_id === 1 ? " is" : "s are"} missing a National ID copy.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Preferred province</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data.by_province.slice(0, 10).map((p) => (
                <div key={p.preferred_province} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-[12.5px]">
                  <span className="truncate">{label("provinces", p.preferred_province)}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{p.n}</span>
                  <div className="col-span-2 mt-1 h-1 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-forest-700/70" style={{ width: `${(p.n / maxProvince) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

