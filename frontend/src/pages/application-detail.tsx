import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Bell,
  CheckCircle2,
  Edit3,
  FileWarning,
  Loader2,
  Mail,
  MessageSquarePlus,
  Printer,
  RotateCcw,
  Send,
  Smartphone,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { ScheduleDialog } from "@/components/application-form";
import { AttachmentPanel } from "@/components/attachment-panel";
import { DecisionActionCard, OfficialSectionsRecord } from "@/components/decision-panel";
import { Field } from "@/components/field";
import { Datum, PageHeader } from "@/components/page";
import { StageTracker } from "@/components/stage-tracker";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  useActivity,
  useApplication,
  useApplicationAction,
  useLabel,
  useNotifyFarmer,
} from "@/lib/queries";
import type { ApplicantNotification, NotificationEvent } from "@/lib/types";

export default function ApplicationDetailPage() {
  const { reference } = useParams<{ reference: string }>();
  const { data: app, isLoading } = useApplication(reference);
  const { data: activities } = useActivity(reference ?? "");
  const label = useLabel();

  const resubmit = useApplicationAction(reference ?? "", "resubmit");
  const withdraw = useApplicationAction(reference ?? "", "withdraw");
  const addNote = useApplicationAction(reference ?? "", "notes");
  const notifyFarmer = useNotifyFarmer(reference ?? "");

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [resubmitNote, setResubmitNote] = useState("");
  const [noteText, setNoteText] = useState("");
  const [selectedNotification, setSelectedNotification] =
    useState<ApplicantNotification | null>(null);

  if (isLoading) {
    return (
      <div className="grid gap-5">
        <Skeleton className="h-14 w-96" />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!app) return <Navigate to="/applications" replace />;

  async function handleNoteSubmit(e: FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    try {
      await addNote.mutateAsync({ message: noteText.trim() });
      setNoteText("");
      toast.success("Note recorded in file activity.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/applications">
            <ArrowLeft /> Back to register
          </Link>
        </Button>
        <ScheduleDialog />
      </div>

      <PageHeader
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2.5">
            <span className="ref text-foreground">{app.application_no}</span>
            <span>·</span>
            <span>Head Office</span>
            <span>·</span>
            <StatusBadge status={app.status} />
          </span>
        }
        title={app.full_name}
        description={`National ID ${app.national_id} · Received ${formatDate(app.date_received)} · Preferred area: ${app.preferred_district}, ${label("provinces", app.preferred_province)}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to={`/applications/${app.reference}/print`} target="_blank">
                <Printer /> Print form
              </Link>
            </Button>
            {app.permissions.edit && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/applications/${app.reference}/edit`}>
                  <Edit3 /> Edit particulars
                </Link>
              </Button>
            )}
            {app.status === "queried" && app.permissions.edit && (
              <Button size="sm" onClick={() => setResubmitOpen(true)}>
                <RotateCcw /> Resubmit after query
              </Button>
            )}
            {app.permissions.withdraw && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setWithdrawOpen(true)}
              >
                <Ban /> Withdraw
              </Button>
            )}
          </>
        }
      />

      {/* Warnings: duplicate National ID or missing required attachments */}
      {app.duplicates.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-gold/50 bg-gold-soft/50 px-4 py-3 text-[13px]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#7a5410]" />
          <div>
            <p className="font-medium text-foreground">
              Note 4 Advisory — Existing application(s) found for National ID{" "}
              <span className="ref">{app.national_id}</span>:
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {app.duplicates.map((dup) => (
                <Link
                  key={dup.reference}
                  to={`/applications/${dup.reference}`}
                  className="inline-flex items-center gap-1.5 rounded border bg-card px-2 py-0.5 text-[12px] hover:underline"
                >
                  <span className="ref">{dup.application_no}</span>
                  <span className="text-muted-foreground">({dup.status})</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {app.missing_attachments.length > 0 && (app.status === "received" || app.status === "queried") && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-earth/30 bg-[#f6e0d9]/45 px-4 py-3 text-[13px]">
          <FileWarning className="mt-0.5 size-4 shrink-0 text-earth" />
          <p>
            <span className="font-medium">Missing mandatory attachments:</span>{" "}
            {app.missing_attachments.map((m) => label("attachment_types", m)).join(", ")}. Attach
            these under the{" "}
            <span className="font-medium">Attachments</span> tab before forwarding to the
            Resettlement Committee.
          </p>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
        {/* Left column */}
        <div>
          <Tabs defaultValue="particulars">
            <TabsList>
              <TabsTrigger value="particulars">Form Particulars (A–G)</TabsTrigger>
              <TabsTrigger value="attachments">
                Attachments ({app.attachments.length})
              </TabsTrigger>
              <TabsTrigger value="activity">
                Audit Trail ({activities?.length ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="particulars" className="grid gap-5">
              {/* Section A */}
              <Card>
                <CardHeader>
                  <div>
                    <span className="eyebrow">Section A</span>
                    <CardTitle className="mt-0.5">Particulars of the Applicant</CardTitle>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {app.categories.map((c) => (
                      <Badge key={c} variant="gold">
                        {label("categories", c)}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 sm:grid-cols-3">
                    <Datum label="1(a) Title">{label("titles", app.title)}</Datum>
                    <Datum label="1(b) Surname">{app.surname}</Datum>
                    <Datum label="1(c) Other Names">{app.other_names}</Datum>
                    <Datum label="1(d) Sex">{label("sexes", app.sex)}</Datum>
                    <Datum label="1(e) Marital Status">
                      {label("marital_statuses", app.marital_status)}
                    </Datum>
                    <Datum label="1(f) National ID" mono>
                      {app.national_id}
                    </Datum>
                    <Datum label="Date of Birth">{formatDate(app.date_of_birth)}</Datum>
                    <Datum label="3. Occupation" className="sm:col-span-2">
                      {app.occupation}
                    </Datum>
                    <Datum label="2(a) Postal Address" className="sm:col-span-1">
                      <span className="whitespace-pre-line">{app.postal_address || "—"}</span>
                    </Datum>
                    <Datum label="2(b) Residential Address" className="sm:col-span-2">
                      <span className="whitespace-pre-line">{app.residential_address}</span>
                    </Datum>
                    <Datum label="2(c) Tel No. Business">{app.business_phone}</Datum>
                    <Datum label="Residential Tel.">{app.residential_phone}</Datum>
                    <Datum label="Mobile Phone">{app.mobile_phone}</Datum>
                    <Datum label="Email Address" className="sm:col-span-2">
                      {app.email}
                    </Datum>
                  </dl>
                </CardContent>
              </Card>

              {/* Section B */}
              <Card>
                <CardHeader>
                  <div>
                    <span className="eyebrow">Section B</span>
                    <CardTitle className="mt-0.5">Area & Farming Programme Preferred</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Datum label="4(a) Preferred Province">
                      {label("provinces", app.preferred_province)}
                    </Datum>
                    <Datum label="4(b) Preferred District">{app.preferred_district}</Datum>
                    <Datum label="5. Farm Type Preferred">
                      {label("farm_types", app.farm_type)}
                    </Datum>
                    <Datum label="6. Type of Farming Preferred">
                      {label("farming_types", app.farming_type)}
                      {app.farming_type === "other" && app.farming_type_other
                        ? ` (${app.farming_type_other})`
                        : ""}
                    </Datum>
                  </dl>
                  <dl className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                    <Datum label="7. Training / Agri-Industry Experience">
                      <span className="whitespace-pre-line">
                        {app.experience_summary || "No statement recorded"}
                      </span>
                    </Datum>
                    <Datum label="7. Cash / Movable Assets Summary">
                      <span className="whitespace-pre-line">
                        {app.resources_summary || "No statement recorded"}
                      </span>
                    </Datum>
                  </dl>
                </CardContent>
              </Card>

              {/* Section C */}
              <Card>
                <CardHeader>
                  <div>
                    <span className="eyebrow">Section C</span>
                    <CardTitle className="mt-0.5">Statutory Declaration</CardTitle>
                  </div>
                  <Badge variant={app.declaration_signed ? "forest" : "earth"}>
                    {app.declaration_signed ? "Signed" : "Unsigned"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 sm:grid-cols-3">
                    <Datum label="Declarant Full Name">{app.declaration_name}</Datum>
                    <Datum label="Date Signed">{formatDate(app.declaration_date)}</Datum>
                    <Datum label="Captured By">{app.created_by.full_name}</Datum>
                  </dl>
                </CardContent>
              </Card>

              {/* Official Use Only Sections D–G */}
              <OfficialSectionsRecord application={app} />
            </TabsContent>

            <TabsContent value="attachments">
              <AttachmentPanel application={app} />
            </TabsContent>

            <TabsContent value="activity" className="grid gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>Add Officer Minute / Note</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleNoteSubmit} className="grid gap-3">
                    <Textarea
                      rows={2}
                      placeholder="Record an internal file note, phone call summary, or site verification remark..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!noteText.trim() || addNote.isPending}
                      >
                        {addNote.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <MessageSquarePlus />
                        )}
                        Add note
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Chronological Audit Log</CardTitle>
                </CardHeader>
                <ul className="divide-y">
                  {activities?.map((act) => (
                    <li key={act.id} className="px-5 py-3.5 text-[13px]">
                      <div className="flex items-baseline justify-between gap-2">
                        <p>
                          <span className="font-medium">{act.actor.full_name}</span>{" "}
                          <span className="text-muted-foreground">
                            ({act.actor.role_display})
                          </span>{" "}
                          — <span className="font-medium">{act.verb_display}</span>
                        </p>
                        <span className="font-mono text-[11.5px] text-muted-foreground">
                          {formatDateTime(act.created_at)}
                        </span>
                      </div>
                      {act.message && (
                        <p className="mt-1 text-muted-foreground">{act.message}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right column: Workflow Stage Tracker + Official Decision Form */}
        <div className="grid gap-5">
          <DecisionActionCard application={app} />

          <Card>
            <CardHeader>
              <CardTitle>Statutory Workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <StageTracker
                status={app.status}
                reviews={app.reviews}
                receivedOn={app.date_received}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-primary" />
                <CardTitle>Farmer Notifications</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3.5">
              {(
                [
                  {
                    event: "application_received" as NotificationEvent,
                    title: "1. Application received",
                    active: true,
                  },
                  {
                    event: "application_approved" as NotificationEvent,
                    title: "2. Application approved",
                    active: app.status === "approved",
                  },
                ] as const
              ).map((stage) => {
                const items = (app.notifications ?? []).filter((n) => n.event === stage.event);
                const latest = items[0];
                return (
                  <div
                    key={stage.event}
                    className="rounded-md border bg-muted/30 p-3 text-[12.5px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{stage.title}</span>
                      {latest ? (
                        <Badge variant={latest.status === "sent" ? "forest" : "earth"}>
                          <CheckCircle2 className="size-3" /> {latest.status_display}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {stage.active ? "Not sent" : "Pending approval"}
                        </Badge>
                      )}
                    </div>

                    {items.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {items.slice(0, 2).map((n) => (
                          <li
                            key={n.id}
                            onClick={() => setSelectedNotification(n)}
                            className="flex cursor-pointer items-center justify-between gap-2 rounded bg-card px-2 py-1 text-[11.5px] transition-colors hover:bg-accent"
                          >
                            <span className="flex min-w-0 items-center gap-1.5 truncate">
                              {n.channel === "sms" ? (
                                <Smartphone className="size-3 shrink-0 text-muted-foreground" />
                              ) : (
                                <Mail className="size-3 shrink-0 text-muted-foreground" />
                              )}
                              <span className="font-medium">{n.channel_display}:</span>
                              <span className="truncate text-muted-foreground">{n.recipient}</span>
                            </span>
                            <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                              {formatDate(n.sent_at, "d MMM HH:mm")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-[11.5px] text-muted-foreground">
                        {stage.event === "application_received"
                          ? "Sent automatically on capture."
                          : "Sent automatically when Section G is approved by the Minister."}
                      </p>
                    )}

                    {stage.active && (
                      <div className="mt-2.5 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11.5px]"
                          disabled={notifyFarmer.isPending}
                          onClick={async () => {
                            try {
                              await notifyFarmer.mutateAsync(stage.event);
                              toast.success(`${stage.title} notification dispatched to farmer.`);
                            } catch (err) {
                              toast.error(errorMessage(err));
                            }
                          }}
                        >
                          <Send className="size-3" />
                          {latest ? "Resend notice" : "Send notice"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Notification preview dialog */}
      <Dialog
        open={!!selectedNotification}
        onOpenChange={(o) => !o && setSelectedNotification(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedNotification?.event_display}</DialogTitle>
            <DialogDescription>
              {selectedNotification?.channel_display} sent to{" "}
              <span className="font-mono text-foreground">{selectedNotification?.recipient}</span>{" "}
              on {formatDateTime(selectedNotification?.sent_at)}
            </DialogDescription>
          </DialogHeader>
          {selectedNotification?.subject && (
            <p className="text-[12.5px] font-medium">{selectedNotification.subject}</p>
          )}
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-3 font-sans text-[12.5px] leading-relaxed">
            {selectedNotification?.body}
          </pre>
        </DialogContent>
      </Dialog>

      {/* Resubmit dialog */}
      <Dialog open={resubmitOpen} onOpenChange={setResubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resubmit Application to Chief Land Officer</DialogTitle>
            <DialogDescription>
              Confirm that the query raised under Section D has been addressed.
            </DialogDescription>
          </DialogHeader>
          <Field label="Resolution Note">
            <Textarea
              rows={3}
              placeholder="Describe what was added or corrected..."
              value={resubmitNote}
              onChange={(e) => setResubmitNote(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResubmitOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={resubmit.isPending}
              onClick={async () => {
                try {
                  await resubmit.mutateAsync({ note: resubmitNote });
                  toast.success("Application returned to Received queue.");
                  setResubmitOpen(false);
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            >
              {resubmit.isPending && <Loader2 className="animate-spin" />}
              Resubmit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Application {app.application_no}</DialogTitle>
            <DialogDescription>
              Withdrawing closes the file permanently. Enter the reason for withdrawal.
            </DialogDescription>
          </DialogHeader>
          <Field label="Reason for Withdrawal" required>
            <Textarea
              rows={3}
              placeholder="e.g. Written withdrawal request signed by applicant on..."
              value={withdrawReason}
              onChange={(e) => setWithdrawReason(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!withdrawReason.trim() || withdraw.isPending}
              onClick={async () => {
                try {
                  await withdraw.mutateAsync({ reason: withdrawReason });
                  toast.success("Application marked as withdrawn.");
                  setWithdrawOpen(false);
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            >
              {withdraw.isPending && <Loader2 className="animate-spin" />}
              Confirm withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

