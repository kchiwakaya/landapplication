import { ArrowLeft, Printer } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { useApplication, useLabel, useMeta } from "@/lib/queries";
import type { Review, StageCode } from "@/lib/types";

function Line({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline gap-2 py-1 text-[13px]">
      <span className="shrink-0 font-medium">{label}</span>
      <span className="flex-1 border-b border-dotted border-black/50 px-2 font-mono text-[13px]">
        {value || "\u00A0"}
      </span>
    </div>
  );
}

export default function PrintApplicationPage() {
  const { reference } = useParams<{ reference: string }>();
  const { data: app, isLoading } = useApplication(reference);
  const { data: meta } = useMeta();
  const label = useLabel();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Skeleton className="h-[800px]" />
      </div>
    );
  }

  if (!app) return <Navigate to="/applications" replace />;

  const byStage = new Map<StageCode, Review>();
  for (const r of app.reviews) byStage.set(r.stage, r);

  return (
    <div className="min-h-screen bg-stone-100 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-6 flex max-w-[210mm] items-center justify-between px-4">
        <Button asChild variant="outline" size="sm">
          <Link to={`/applications/${app.reference}`}>
            <ArrowLeft /> Back to dossier
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer /> Print / Save as PDF
        </Button>
      </div>

      <div className="mx-auto max-w-[210mm] bg-white p-10 text-black shadow-sm print:p-6 print:shadow-none">
        {/* Header & Form Number */}
        <div className="flex items-start justify-between gap-4">
          <img src="/logo.jpg" alt="" className="size-16 object-contain" />
          <div className="w-64 text-[12.5px]">
            <Line label="Application Form No." value={app.application_no} />
            <Line label="Province" value={label("provinces", app.province)} />
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-[14px] font-bold uppercase">
            Ministry of Lands and Rural Development
          </p>
          <p className="mt-1 text-[13.5px] font-bold uppercase">
            Land Reform and Resettlement Programme (Phase II, Model A2)
          </p>
          <p className="mt-1 text-[12.5px] font-semibold uppercase">
            Application for Land Under the Commercial Farm Settlement Scheme (Small, Medium and
            Large Scale Commercial Farms)
          </p>
          <p className="mt-1 text-[12px] italic">
            In terms of the Agricultural Land Settlement Act (Chapter 20:01)
          </p>
        </div>

        {/* Section A */}
        <div className="mt-6">
          <h2 className="text-[13px] font-bold uppercase underline">
            A. Particulars of the Applicant
          </h2>
          <p className="mt-2 text-[12.5px] font-semibold uppercase">
            1. Name of the Applicant in Full (Block Letters)
          </p>
          <div className="mt-1 grid gap-1 pl-4">
            <Line label="(a) TITLE" value={label("titles", app.title).toUpperCase()} />
            <Line label="(b) SURNAME" value={app.surname} />
            <Line label="(c) OTHER NAMES" value={app.other_names} />
            <Line label="(d) SEX" value={label("sexes", app.sex).toUpperCase()} />
            <Line
              label="(e) MARITAL STATUS"
              value={label("marital_statuses", app.marital_status).toUpperCase()}
            />
            <Line label="(f) R. C. NO./I.D. No" value={app.national_id} />
          </div>

          <p className="mt-3 text-[12.5px] font-semibold uppercase">2. Address</p>
          <div className="mt-1 grid gap-1 pl-4">
            <Line label="(a) Postal" value={app.postal_address} />
            <Line label="(b) Residential" value={app.residential_address} />
            <div className="grid grid-cols-2 gap-4">
              <Line label="(c) Tel No. Business" value={app.business_phone} />
              <Line
                label="Residential / Mobile Tel."
                value={app.residential_phone || app.mobile_phone}
              />
            </div>
          </div>

          <div className="mt-2">
            <Line label="3. Occupation" value={app.occupation} />
          </div>
        </div>

        {/* Section B */}
        <div className="mt-6">
          <h2 className="text-[13px] font-bold uppercase underline">B. Area Preferred</h2>
          <div className="mt-1 grid grid-cols-2 gap-4 pl-4">
            <Line label="4. (a) Province" value={label("provinces", app.preferred_province)} />
            <Line label="(b) District" value={app.preferred_district} />
          </div>

          <p className="mt-3 text-[12.5px] font-semibold">
            5. Farm Type Preferred (Tick the Preferred)
          </p>
          <div className="mt-1 grid grid-cols-2 gap-1.5 pl-4 text-[12.5px]">
            {meta?.farm_types.map((ft, idx) => (
              <div key={ft.value} className="flex items-center gap-2">
                <span className="inline-flex size-4 items-center justify-center border border-black font-mono text-[11px]">
                  {app.farm_type === ft.value ? "✓" : ""}
                </span>
                <span>
                  ({["i", "ii", "iii", "iv"][idx]}) {ft.label}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[12.5px] font-semibold">
            6. Type of Farming Preferred [Tick the preferred]
          </p>
          <div className="mt-1 flex flex-wrap gap-6 pl-4 text-[12.5px]">
            {meta?.farming_types.map((ft, idx) => (
              <div key={ft.value} className="flex items-center gap-2">
                <span className="inline-flex size-4 items-center justify-center border border-black font-mono text-[11px]">
                  {app.farming_type === ft.value ? "✓" : ""}
                </span>
                <span>
                  ({["i", "ii", "iii", "iv"][idx]}) {ft.label}
                  {ft.value === "other" && app.farming_type_other
                    ? `: ${app.farming_type_other}`
                    : ""}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[12.5px]">
            7. Attach an annual cash flow projection for a five-year development programme.
          </p>
          {(app.experience_summary || app.resources_summary) && (
            <div className="mt-1 rounded border border-black/30 p-2.5 text-[12px]">
              {app.experience_summary && (
                <p>
                  <strong>Training / Experience:</strong> {app.experience_summary}
                </p>
              )}
              {app.resources_summary && (
                <p className="mt-1">
                  <strong>Resources / Movable Assets:</strong> {app.resources_summary}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Section C */}
        <div className="mt-6">
          <h2 className="text-[13px] font-bold uppercase underline">C. Declaration</h2>
          <p className="mt-1.5 text-[12px] leading-relaxed">
            I, (full name){" "}
            <span className="border-b border-dotted border-black px-2 font-mono font-semibold">
              {app.declaration_name}
            </span>{" "}
            do sincerely declare that the particulars given on this application form are true and
            correct and that I have not withheld any information which might affect my application.
            I am aware of the provision in section 38 (a) of the Agricultural Land Settlement Act
            (Chapter 20:01) namely “a person who makes a false statement knowing it to be false in
            connection with an application for a holding shall be guilty of an offence and liable to
            a fine not exceeding $200 or in default of payment, to imprisonment of a period not
            exceeding six months”.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-8">
            <Line label="Date" value={formatDate(app.declaration_date)} />
            <Line
              label="Signature"
              value={app.declaration_signed ? `Signed (${app.declaration_name})` : "Unsigned"}
            />
          </div>
        </div>

        {/* Official Use Only Sections D–G */}
        <div className="mt-8 border-t-2 border-black pt-4">
          <p className="text-center text-[13px] font-bold uppercase underline">
            For Official Use Only
          </p>

          {/* Section D */}
          <div className="mt-3">
            <h3 className="text-[12.5px] font-bold uppercase">
              D. Government Officials’ Comments
            </h3>
            <p className="text-[12px]">
              Chief Land Officer,{" "}
              <span className="underline">{label("provinces", app.province)}</span> Province
            </p>
            <div className="mt-1 min-h-12 border-b border-dotted border-black/60 py-1 font-mono text-[12px]">
              {byStage.get("D")?.comments || "\u00A0"}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-8">
              <Line label="Date" value={formatDate(byStage.get("D")?.decision_date)} />
              <Line label="Signature" value={byStage.get("D")?.signatory_name} />
            </div>
          </div>

          {/* Section E */}
          <div className="mt-4">
            <h3 className="text-[12.5px] font-bold">
              E. The Land Identification and Resettlement Committee ({label("provinces", app.province)}{" "}
              Province)
            </h3>
            <p className="mt-1 text-[12px]">
              At its meeting of{" "}
              <span className="border-b border-dotted border-black px-2 font-mono">
                {formatDate(byStage.get("E")?.meeting_date)}
              </span>
              , the Committee recommended that the application for unit{" "}
              <span className="border-b border-dotted border-black px-2 font-mono">
                {app.allocated_unit || "—"}
              </span>{" "}
              by this applicant be:{" "}
              <strong className="uppercase">{byStage.get("E")?.outcome_display || "—"}</strong>
            </p>
            <div className="mt-2 grid grid-cols-2 gap-8">
              <Line label="DATE" value={formatDate(byStage.get("E")?.decision_date)} />
              <Line label="SIGNED (Chairperson)" value={byStage.get("E")?.signatory_name} />
            </div>
          </div>

          {/* Section F */}
          <div className="mt-4">
            <h3 className="text-[12.5px] font-bold">
              F. Agricultural Land Settlement Board:{" "}
              <span className="uppercase underline">
                {byStage.get("F")?.outcome_display || "Recommended / Not Recommended"}
              </span>
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-8">
              <Line label="Date" value={formatDate(byStage.get("F")?.decision_date)} />
              <Line label="Signed (Board)" value={byStage.get("F")?.signatory_name} />
            </div>
          </div>

          {/* Section G */}
          <div className="mt-4">
            <h3 className="text-[12.5px] font-bold">
              G. Minister of Lands and Rural Development:{" "}
              <span className="uppercase underline">
                {byStage.get("G")?.outcome_display || "Approved / Not Approved"}
              </span>
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-8">
              <Line label="Date" value={formatDate(byStage.get("G")?.decision_date)} />
              <Line label="Signed (Minister)" value={byStage.get("G")?.signatory_name} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

