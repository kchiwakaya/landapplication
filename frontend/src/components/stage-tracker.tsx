import { Check, Minus, X } from "lucide-react";

import { formatDate } from "@/lib/format";
import type { Review, StageCode, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS: { code: "C" | StageCode; title: string; who: string }[] = [
  { code: "C", title: "Captured", who: "Sections A–C" },
  { code: "D", title: "Land Officer", who: "Provincial CLO" },
  { code: "E", title: "Committee", who: "Identification & Resettlement" },
  { code: "F", title: "Board", who: "Land Settlement Board" },
  { code: "G", title: "Minister", who: "Final approval" },
];

const ACTIVE_STEP: Partial<Record<Status, string>> = {
  received: "D",
  queried: "D",
  committee: "E",
  board: "F",
  minister: "G",
};

type StepState = "done" | "negative" | "current" | "queried" | "upcoming" | "skipped";

/**
 * Vertical progress through the form's official-use sections. Each step shows
 * who signed it off and when, so an officer can see at a glance where a file is.
 */
export function StageTracker({
  status,
  reviews,
  receivedOn,
}: {
  status: Status;
  reviews: Review[];
  receivedOn: string;
}) {
  const latest = new Map<string, Review>();
  for (const r of reviews) latest.set(r.stage, r);
  const active = ACTIVE_STEP[status];
  const terminated = status === "rejected" || status === "withdrawn";

  return (
    <ol className="relative">
      {STEPS.map((step, i) => {
        const review = latest.get(step.code);
        let state: StepState = "upcoming";
        if (step.code === "C") state = "done";
        else if (step.code === active) state = status === "queried" ? "queried" : "current";
        else if (review && review.outcome !== "query") state = review.outcome === "negative" ? "negative" : "done";
        else if (terminated) state = "skipped";

        const isLast = i === STEPS.length - 1;
        return (
          <li key={step.code} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                className={cn(
                  "absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px",
                  state === "done" ? "bg-forest-700/50" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-[23px] shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-medium",
                state === "done" && "border-forest-700 bg-forest-700 text-white",
                state === "negative" && "border-earth bg-earth text-white",
                state === "current" && "border-primary bg-card text-primary ring-4 ring-forest-100",
                state === "queried" && "border-gold bg-gold-soft text-[#7a5410] ring-4 ring-gold-soft/60",
                state === "upcoming" && "border-input bg-card text-muted-foreground",
                state === "skipped" && "border-dashed border-input bg-muted text-muted-foreground/60",
              )}
            >
              {state === "done" ? (
                <Check className="size-3" strokeWidth={3} />
              ) : state === "negative" ? (
                <X className="size-3" strokeWidth={3} />
              ) : state === "skipped" ? (
                <Minus className="size-3" />
              ) : (
                step.code
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className={cn(
                    "text-[13px] font-medium",
                    (state === "upcoming" || state === "skipped") && "text-muted-foreground",
                  )}
                >
                  {step.title}
                </p>
                {step.code === "C" ? (
                  <span className="text-[11.5px] text-muted-foreground">{formatDate(receivedOn, "d MMM")}</span>
                ) : review && state !== "current" && state !== "queried" ? (
                  <span className="text-[11.5px] text-muted-foreground">{formatDate(review.decision_date, "d MMM")}</span>
                ) : null}
              </div>
              <p className="text-[12px] text-muted-foreground">
                {state === "current"
                  ? "Awaiting decision"
                  : state === "queried"
                    ? "Returned with a query"
                    : review && state !== "upcoming" && state !== "skipped"
                      ? `${review.outcome_display} · ${review.signatory_name}`
                      : step.who}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

