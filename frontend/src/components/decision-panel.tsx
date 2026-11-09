import { Check, HelpCircle, Loader2, ShieldAlert, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/format";
import { useDecide, useLabel, useMeta } from "@/lib/queries";
import type { ApplicationDetail, Outcome, Review, StageCode } from "@/lib/types";

const STAGE_DESIGNATIONS: Record<StageCode, string> = {
  D: "Provincial Chief Land Officer",
  E: "Chairperson, Land Identification & Resettlement Committee",
  F: "Chairperson, Agricultural Land Settlement Board",
  G: "Minister of Lands and Rural Development",
};

export function DecisionActionCard({ application }: { application: ApplicationDetail }) {
  const { user } = useAuth();
  const { data: meta } = useMeta();
  const decide = useDecide(application.reference);

  const stage = application.current_stage;
  const [outcome, setOutcome] = useState<Outcome>("positive");
  const [comments, setComments] = useState("");
  const [meetingDate, setMeetingDate] = useState(todayISO());
  const [decisionDate, setDecisionDate] = useState(todayISO());
  const [signatoryName, setSignatoryName] = useState(user?.full_name || "");
  const signatoryDesignation = stage ? STAGE_DESIGNATIONS[stage.code] : "";
  const [naturalRegion, setNaturalRegion] = useState(application.natural_region || "IIa");
  const [allocatedUnit, setAllocatedUnit] = useState(application.allocated_unit || "");
  const [allocatedHectares, setAllocatedHectares] = useState(
    application.allocated_hectares ? String(application.allocated_hectares) : "",
  );

  if (!stage) return null;

  if (!application.permissions.decide) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Section {stage.code} · Awaiting Action</CardTitle>
        </CardHeader>
        <CardContent className="text-[13px] text-muted-foreground">
          This file is currently at <span className="font-medium text-foreground">{stage.label}</span>{" "}
          and must be actioned by the <span className="font-medium text-foreground">{stage.role_display}</span>.
        </CardContent>
      </Card>
    );
  }

  const outcomes = Object.entries(stage.outcomes) as [Outcome, string][];
  const showAllocation = stage.code === "E" || stage.code === "F" || stage.code === "G";
  const blockedByMissingDocs =
    stage.code === "D" && outcome !== "query" && application.missing_attachments.length > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await decide.mutateAsync({
        outcome,
        comments,
        meeting_date: stage?.code === "E" ? meetingDate : null,
        decision_date: decisionDate,
        signatory_name: signatoryName,
        signatory_designation: signatoryDesignation,
        natural_region: showAllocation ? naturalRegion : "",
        allocated_unit: showAllocation ? allocatedUnit : "",
        allocated_hectares: showAllocation && allocatedHectares ? allocatedHectares : null,
      });
      if (stage?.code === "G" && outcome === "positive") {
        toast.success("Application approved and approval notification sent to farmer.");
      } else {
        toast.success(`Section ${stage?.code} decision recorded.`);
      }
      setComments("");
    } catch (err) {
      toast.error(errorMessage(err, "Could not record decision."));
    }
  }

  return (
    <Card className="border-primary/35">
      <CardHeader className="bg-forest-100/40">
        <div>
          <span className="eyebrow text-forest-700">Official Use Only · Section {stage.code}</span>
          <CardTitle className="mt-0.5">{stage.label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3.5">
          <Field label="Decision / Outcome" required>
            <div className="grid grid-cols-2 gap-2">
              {outcomes.map(([key, label]) => {
                const active = outcome === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setOutcome(key)}
                    className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-[12.5px] font-medium transition-colors ${
                      active
                        ? key === "positive"
                          ? "border-forest-700 bg-forest-700 text-white"
                          : key === "negative"
                            ? "border-earth bg-earth text-white"
                            : "border-gold bg-gold text-forest-900"
                        : "border-input bg-card hover:bg-muted/60"
                    }`}
                  >
                    {key === "positive" ? (
                      <Check className="size-3.5" />
                    ) : key === "negative" ? (
                      <X className="size-3.5" />
                    ) : (
                      <HelpCircle className="size-3.5" />
                    )}
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>

          {blockedByMissingDocs && (
            <div className="flex items-start gap-2 rounded-md border border-earth/30 bg-[#f6e0d9]/60 p-2.5 text-[12px] text-earth">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                National ID and 5-year Cash Flow Projection must be attached before forwarding to
                Committee. Upload them in the Attachments tab or raise a Query.
              </span>
            </div>
          )}

          {stage.code === "E" && (
            <Field label="Committee Meeting Date" required>
              <Input
                type="date"
                max={todayISO()}
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                required
              />
            </Field>
          )}

          {showAllocation && (
            <div className="grid gap-3 rounded-md border bg-muted/40 p-3">
              <p className="eyebrow">Land Holding Unit & Schedule I</p>
              <Field label="Recommended Farm / Unit (Subdivision & Farm Name)">
                <Input
                  placeholder="e.g. Subdivision 4 of Lot 12, Wenimbi Estate"
                  value={allocatedUnit}
                  onChange={(e) => setAllocatedUnit(e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Natural Region">
                  <Select value={naturalRegion} onValueChange={setNaturalRegion}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {meta?.natural_regions.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Size (Hectares)">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 250"
                    value={allocatedHectares}
                    onChange={(e) => setAllocatedHectares(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          )}

          <Field
            label={
              outcome === "query"
                ? "Query Details (Required)"
                : stage.code === "D"
                  ? "Chief Land Officer’s Comments"
                  : "Official Remarks / Minute"
            }
            required={outcome === "query" || stage.code === "D"}
          >
            <Textarea
              rows={3}
              placeholder={
                outcome === "query"
                  ? "State what documents or clarifications are required..."
                  : "Record assessment of applicant suitability, capital readiness, and Schedule I alignment..."
              }
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              required={outcome === "query" || stage.code === "D"}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Signatory Name" required>
              <Input
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
                required
              />
            </Field>
            <Field label="Date Signed" required>
              <Input
                type="date"
                max={todayISO()}
                value={decisionDate}
                onChange={(e) => setDecisionDate(e.target.value)}
                required
              />
            </Field>
          </div>

          <Button type="submit" disabled={decide.isPending || blockedByMissingDocs}>
            {decide.isPending && <Loader2 className="animate-spin" />}
            Record Section {stage.code} Decision
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Renders Sections D, E, F, and G ("FOR OFFICIAL USE ONLY") matching page 4
 * of the statutory A2 form.
 */
export function OfficialSectionsRecord({ application }: { application: ApplicationDetail }) {
  const label = useLabel();
  const byStage = new Map<StageCode, Review>();
  for (const r of application.reviews) {
    byStage.set(r.stage, r);
  }

  const sections: {
    code: StageCode;
    title: string;
    subtitle: string;
  }[] = [
    {
      code: "D",
      title: "D. Government Officials’ Comments",
      subtitle: `Chief Land Officer, ${label("provinces", application.province)} Province`,
    },
    {
      code: "E",
      title: "E. The Land Identification and Resettlement Committee",
      subtitle: `${label("provinces", application.province)} Province`,
    },
    {
      code: "F",
      title: "F. Recommended / Not Recommended",
      subtitle: "Agricultural Land Settlement Board",
    },
    {
      code: "G",
      title: "G. Approved / Not Approved",
      subtitle: "Minister of Lands and Rural Development",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div>
          <span className="eyebrow">Sections D – G</span>
          <CardTitle className="mt-0.5">For Official Use Only</CardTitle>
        </div>
        {application.allocated_unit && (
          <Badge variant="forest">
            Unit: {application.allocated_unit}
            {application.allocated_hectares ? ` (${application.allocated_hectares} ha)` : ""}
          </Badge>
        )}
      </CardHeader>
      <div className="divide-y">
        {sections.map((s) => {
          const rev = byStage.get(s.code);
          return (
            <div key={s.code} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h4 className="text-[13.5px] font-semibold">{s.title}</h4>
                  <p className="text-[12px] text-muted-foreground">{s.subtitle}</p>
                </div>
                {rev ? (
                  <Badge
                    variant={
                      rev.outcome === "positive"
                        ? "forest"
                        : rev.outcome === "negative"
                          ? "earth"
                          : "gold"
                    }
                  >
                    {rev.outcome_display}
                  </Badge>
                ) : (
                  <span className="text-[12px] text-muted-foreground">Pending</span>
                )}
              </div>

              {rev ? (
                <div className="mt-2.5 space-y-2 text-[13px]">
                  {s.code === "E" && (
                    <p className="rounded bg-muted/50 px-3 py-2 text-[12.5px]">
                      At its meeting of{" "}
                      <span className="font-medium">
                        {formatDate(rev.meeting_date || rev.decision_date)}
                      </span>
                      , the Committee recommended that the application
                      {application.allocated_unit ? (
                        <>
                          {" "}
                          for unit <span className="font-medium">{application.allocated_unit}</span>
                        </>
                      ) : null}{" "}
                      by this applicant be{" "}
                      <span className="font-semibold lowercase">{rev.outcome_display}d</span>.
                    </p>
                  )}
                  {rev.comments && (
                    <p className="whitespace-pre-line text-foreground/90">{rev.comments}</p>
                  )}
                  <p className="text-[12px] text-muted-foreground">
                    Signed: <span className="font-medium text-foreground">{rev.signatory_name}</span>
                    {rev.signatory_designation ? ` (${rev.signatory_designation})` : ""} · Date:{" "}
                    <span className="font-mono">{formatDate(rev.decision_date)}</span>
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
