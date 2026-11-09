import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, HelpCircle, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Field, FormSection } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { fieldErrors } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatBytes, todayISO } from "@/lib/format";
import { useMeta } from "@/lib/queries";
import type { ApplicationInput } from "@/lib/types";

const NATIONAL_ID_REGEX = /^(\d{2})-?(\d{6,7})\s*([A-Za-z])\s*(\d{2})$/;

const schema = z
  .object({
    province: z.string().min(1, "Select receiving province"),
    source: z.string().min(1, "Select application source"),
    date_received: z.string().min(1, "Enter date received"),
    title: z.string().min(1, "Select title"),
    surname: z.string().trim().min(1, "Enter applicant surname"),
    other_names: z.string().trim().min(1, "Enter other names"),
    sex: z.string().min(1, "Select sex"),
    marital_status: z.string().min(1, "Select marital status"),
    national_id: z
      .string()
      .trim()
      .regex(NATIONAL_ID_REGEX, "Use Zimbabwean ID format, e.g. 63-1234567A89"),
    date_of_birth: z.string().nullable().optional(),
    categories: z.array(z.string()),
    postal_address: z.string().optional().default(""),
    residential_address: z.string().trim().min(1, "Enter residential address"),
    business_phone: z.string().optional().default(""),
    residential_phone: z.string().optional().default(""),
    mobile_phone: z.string().optional().default(""),
    email: z.union([z.literal(""), z.string().email("Enter a valid email address")]),
    occupation: z.string().trim().min(1, "Enter occupation"),
    preferred_province: z.string().min(1, "Select preferred province"),
    preferred_district: z.string().min(1, "Select preferred district"),
    farm_type: z.string().min(1, "Select preferred farm type"),
    farming_type: z.string().min(1, "Select preferred type of farming"),
    farming_type_other: z.string().optional().default(""),
    experience_summary: z.string().optional().default(""),
    resources_summary: z.string().optional().default(""),
    declaration_name: z.string().trim().min(1, "Enter full name of declarant"),
    declaration_date: z.string().min(1, "Enter declaration date"),
    declaration_signed: z.boolean().refine((v) => v === true, {
      message: "Applicant must sign the statutory declaration",
    }),
  })
  .superRefine((val, ctx) => {
    if (!val.business_phone && !val.residential_phone && !val.mobile_phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mobile_phone"],
        message: "Provide at least one telephone or mobile number",
      });
    }
    if (val.farming_type === "other" && !val.farming_type_other?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["farming_type_other"],
        message: "Specify the other type of farming",
      });
    }
  });

export type QueuedAttachment = {
  id: string;
  doc_type: string;
  file: File;
  note: string;
};

export function ScheduleDialog() {
  const { data: meta } = useMeta();
  if (!meta) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <HelpCircle /> Schedule I: Farm sizes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Schedule I — Recommended Farm Sizes (Hectares)</DialogTitle>
          <DialogDescription>
            Maximum recommended farm sizes under the Model A2 Commercial Farm Settlement Scheme by Natural
            Agro-Ecological Zone.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agro-Ecological Zone</TableHead>
                <TableHead>Small-scale</TableHead>
                <TableHead>Medium-scale</TableHead>
                <TableHead>Large-scale</TableHead>
                <TableHead>Peri-urban</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meta.farm_size_schedule.map((row, idx) => (
                <TableRow key={row.region}>
                  <TableCell className="font-mono font-medium">Region {row.region}</TableCell>
                  <TableCell className="font-mono">{row.small} ha</TableCell>
                  <TableCell className="font-mono">{row.medium} ha</TableCell>
                  <TableCell className="font-mono">{row.large} ha</TableCell>
                  {idx === 0 && (
                    <TableCell rowSpan={meta.farm_size_schedule.length} className=" border-l align-middle font-mono">
                      {meta.peri_urban_size} ha
                      <span className="block font-sans text-[11px] text-muted-foreground">All zones</span>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ApplicationForm({
  defaultValues,
  submitLabel = "Save application",
  allowAttachments = false,
  onSubmit,
  onCancel,
}: {
  defaultValues?: Partial<ApplicationInput>;
  submitLabel?: string;
  allowAttachments?: boolean;
  onSubmit: (values: ApplicationInput, attachments: QueuedAttachment[]) => Promise<void>;
  onCancel?: () => void;
}) {
  const { user } = useAuth();
  const { data: meta } = useMeta();
  const [queued, setQueued] = useState<QueuedAttachment[]>([]);
  const [selectedDocType, setSelectedDocType] = useState("national_id");
  const [docNote, setDocNote] = useState("");

  const today = todayISO();

  const form = useForm<ApplicationInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      province: defaultValues?.province || user?.province || "mashonaland_east",
      source: defaultValues?.source || "walk_in",
      date_received: defaultValues?.date_received || today,
      title: defaultValues?.title || "mr",
      surname: defaultValues?.surname || "",
      other_names: defaultValues?.other_names || "",
      sex: defaultValues?.sex || "male",
      marital_status: defaultValues?.marital_status || "married",
      national_id: defaultValues?.national_id || "",
      date_of_birth: defaultValues?.date_of_birth || null,
      categories: defaultValues?.categories || [],
      postal_address: defaultValues?.postal_address || "",
      residential_address: defaultValues?.residential_address || "",
      business_phone: defaultValues?.business_phone || "",
      residential_phone: defaultValues?.residential_phone || "",
      mobile_phone: defaultValues?.mobile_phone || "",
      email: defaultValues?.email || "",
      occupation: defaultValues?.occupation || "",
      preferred_province:
        defaultValues?.preferred_province || defaultValues?.province || user?.province || "mashonaland_east",
      preferred_district: defaultValues?.preferred_district || "",
      farm_type: defaultValues?.farm_type || "small",
      farming_type: defaultValues?.farming_type || "mixed",
      farming_type_other: defaultValues?.farming_type_other || "",
      experience_summary: defaultValues?.experience_summary || "",
      resources_summary: defaultValues?.resources_summary || "",
      declaration_name: defaultValues?.declaration_name || "",
      declaration_date: defaultValues?.declaration_date || today,
      declaration_signed: defaultValues?.declaration_signed ?? true,
    },
  });

  const preferredProvince = form.watch("preferred_province");
  const farmingType = form.watch("farming_type");
  const surname = form.watch("surname");
  const otherNames = form.watch("other_names");
  const districts = meta?.districts[preferredProvince] ?? [];

  // Keep preferred_district valid when preferred_province changes
  useEffect(() => {
    if (!meta) return;
    const current = form.getValues("preferred_district");
    const list = meta.districts[preferredProvince] ?? [];
    if (list.length > 0 && (!current || !list.includes(current))) {
      form.setValue("preferred_district", list[0]);
    }
  }, [preferredProvince, meta, form]);

  // Pre-fill declaration name if not manually edited yet
  useEffect(() => {
    if (defaultValues?.declaration_name) return;
    const combined = `${otherNames} ${surname}`.trim().toUpperCase();
    if (combined && !form.getFieldState("declaration_name").isDirty) {
      form.setValue("declaration_name", combined);
    }
  }, [surname, otherNames, defaultValues?.declaration_name, form]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxSize: 10 * 1024 * 1024,
    onDropAccepted: (files) => {
      const additions = files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        doc_type: selectedDocType,
        file,
        note: docNote.trim(),
      }));
      setQueued((prev) => [...prev, ...additions]);
      setDocNote("");
      // Advance default selector from national_id -> cash_flow for convenience
      if (selectedDocType === "national_id") {
        setSelectedDocType("cash_flow");
      }
    },
  });

  async function handleSubmit(values: ApplicationInput) {
    try {
      await onSubmit(
        {
          ...values,
          date_of_birth: values.date_of_birth || null,
        },
        queued,
      );
    } catch (err) {
      const errs = fieldErrors(err);
      for (const [key, msg] of Object.entries(errs)) {
        form.setError(key as keyof ApplicationInput, { message: msg });
      }
      throw err;
    }
  }

  const errors = form.formState.errors;
  const submitting = form.formState.isSubmitting;
  const lockProvince = Boolean(user?.province && user.role !== "admin");

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="divide-y">
      {/* Registry Metadata */}
      <FormSection
        title="Registry Intake"
        description="Record where and how this application form was received by the Ministry."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Receiving Province Office" required error={errors.province?.message}>
            <Controller
              control={form.control}
              name="province"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={lockProvince}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    {meta?.provinces.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Submission Channel" required error={errors.source?.message}>
            <Controller
              control={form.control}
              name="source"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meta?.sources.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Date Received" required error={errors.date_received?.message}>
            <Input type="date" max={today} {...form.register("date_received")} />
          </Field>
        </div>
      </FormSection>

      {/* Section A: Particulars of the Applicant */}
      <FormSection
        letter="A"
        title="Particulars of the Applicant"
        description="Item 1–3 of the form. Names are stored in block letters as required on the statutory form."
      >
        <div className="grid gap-4 sm:grid-cols-12">
          <Field label="1(a) Title" required error={errors.title?.message} className="sm:col-span-2">
            <Controller
              control={form.control}
              name="title"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meta?.titles.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field
            label="1(b) Surname (Block Letters)"
            required
            error={errors.surname?.message}
            className="sm:col-span-5"
          >
            <Input
              placeholder="e.g. MUTASA"
              className="uppercase"
              {...form.register("surname")}
            />
          </Field>

          <Field
            label="1(c) Other Names (Block Letters)"
            required
            error={errors.other_names?.message}
            className="sm:col-span-5"
          >
            <Input
              placeholder="e.g. FARAI"
              className="uppercase"
              {...form.register("other_names")}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="1(d) Sex" required error={errors.sex?.message}>
            <Controller
              control={form.control}
              name="sex"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meta?.sexes.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="1(e) Marital Status" required error={errors.marital_status?.message}>
            <Controller
              control={form.control}
              name="marital_status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meta?.marital_statuses.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field
            label="1(f) R.C. No. / National I.D. No."
            required
            hint="Format: 63-1234567A89"
            error={errors.national_id?.message}
          >
            <Input
              placeholder="63-1234567A89"
              className="font-mono uppercase"
              {...form.register("national_id")}
            />
          </Field>

          <Field label="Date of Birth" error={errors.date_of_birth?.message}>
            <Input type="date" max={today} {...form.register("date_of_birth")} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="2(a) Postal Address"
            error={errors.postal_address?.message}
          >
            <Textarea
              rows={2}
              placeholder="P.O. Box or Private Bag..."
              {...form.register("postal_address")}
            />
          </Field>

          <Field
            label="2(b) Residential Address"
            required
            error={errors.residential_address?.message}
          >
            <Textarea
              rows={2}
              placeholder="Stand / Plot / Street and Town..."
              {...form.register("residential_address")}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="2(c) Tel No. Business" error={errors.business_phone?.message}>
            <Input placeholder="Optional" {...form.register("business_phone")} />
          </Field>

          <Field label="Residential Tel." error={errors.residential_phone?.message}>
            <Input placeholder="Optional" {...form.register("residential_phone")} />
          </Field>

          <Field label="Mobile Phone" required error={errors.mobile_phone?.message}>
            <Input placeholder="+263 77..." {...form.register("mobile_phone")} />
          </Field>

          <Field label="Email Address" error={errors.email?.message}>
            <Input type="email" placeholder="applicant@example.com" {...form.register("email")} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="3. Occupation" required error={errors.occupation?.message}>
            <Input placeholder="e.g. Agronomist, Civil Servant, Farmer" {...form.register("occupation")} />
          </Field>

          <Field
            label="Applicant Categories (Note 2)"
            hint="Tick all applicable categories for statistical and priority tracking."
          >
            <Controller
              control={form.control}
              name="categories"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2 pt-1">
                  {meta?.categories.map((cat) => {
                    const checked = field.value?.includes(cat.value);
                    return (
                      <label
                        key={cat.value}
                        className="flex cursor-pointer items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-[12.5px] transition-colors hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(isChecked) => {
                            const next = isChecked
                              ? [...(field.value ?? []), cat.value]
                              : (field.value ?? []).filter((v) => v !== cat.value);
                            field.onChange(next);
                          }}
                        />
                        <span>{cat.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            />
          </Field>
        </div>
      </FormSection>

      {/* Section B: Area Preferred */}
      <FormSection
        letter="B"
        title="Area & Farming Programme Preferred"
        description={
          <div className="space-y-3">
            <p>
              Item 4–7 of the form. A choice of only one land holding is permitted per application form.
            </p>
            <ScheduleDialog />
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="4(a) Province Preferred" required error={errors.preferred_province?.message}>
            <Controller
              control={form.control}
              name="preferred_province"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meta?.provinces.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="4(b) District Preferred" required error={errors.preferred_district?.message}>
            <Controller
              control={form.control}
              name="preferred_district"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <Field label="5. Farm Type Preferred (Tick the Preferred)" required error={errors.farm_type?.message}>
          <Controller
            control={form.control}
            name="farm_type"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="grid gap-2.5 sm:grid-cols-2"
              >
                <RadioCard
                  value="small"
                  title="(i) Small-scale Commercial Settlement"
                  description="15 – 350 ha depending on Natural Region I–V"
                />
                <RadioCard
                  value="medium"
                  title="(ii) Medium-scale Commercial Settlement"
                  description="100 – 1 500 ha depending on Natural Region I–V"
                />
                <RadioCard
                  value="large"
                  title="(iii) Large-scale Commercial Settlement"
                  description="250 – 2 000 ha depending on Natural Region I–V"
                />
                <RadioCard
                  value="peri_urban"
                  title="(iv) Peri-urban Commercial Settlement"
                  description="15 to 50 ha across all agro-ecological zones"
                />
              </RadioGroup>
            )}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="6. Type of Farming Preferred" required error={errors.farming_type?.message}>
            <Controller
              control={form.control}
              name="farming_type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meta?.farming_types.map((ft) => (
                      <SelectItem key={ft.value} value={ft.value}>
                        {ft.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {farmingType === "other" && (
            <Field
              label="Specify Other Farming Type"
              required
              error={errors.farming_type_other?.message}
            >
              <Input
                placeholder="e.g. Horticulture, Apiculture, Aquaculture, Wildlife"
                {...form.register("farming_type_other")}
              />
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="7(a) Training or Experience in the Agri-Industry"
            hint="Summary of qualifications, Master Farmer certificates, or practical experience."
            error={errors.experience_summary?.message}
          >
            <Textarea
              rows={3}
              placeholder="Summarize agricultural training, diplomas, or years of farming experience..."
              {...form.register("experience_summary")}
            />
          </Field>

          <Field
            label="7(b) Ability to Mobilise Resources (Cash & Movable Assets)"
            hint="Summary of capital, tractors, implements, livestock, or credit lines."
            error={errors.resources_summary?.message}
          >
            <Textarea
              rows={3}
              placeholder="Summarize available capital, bank balances, equipment, or livestock..."
              {...form.register("resources_summary")}
            />
          </Field>
        </div>
      </FormSection>

      {/* Attachments Queue (Only during initial capture) */}
      {allowAttachments && (
        <FormSection
          title="Attachments & Supporting Documents"
          description="Attach the applicant's National ID, 5-year cash flow projection (Item 7), proof of training, and proof of funds."
        >
          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Document Type">
                <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meta?.attachment_types.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                        {meta.required_attachments.includes(a.value) ? " (Required)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reference Note (Optional)">
                <Input
                  placeholder="e.g. Certified copy, CBZ Bank statement..."
                  value={docNote}
                  onChange={(e) => setDocNote(e.target.value)}
                />
              </Field>
            </div>

            <div
              {...getRootProps()}
              className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-center transition-colors ${
                isDragActive ? "border-primary bg-forest-100/40" : "border-input hover:bg-muted/40"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mb-2 size-5 text-muted-foreground" />
              <p className="text-[13px] font-medium">
                Drop file here or <span className="text-primary underline">browse computer</span>
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                PDF, JPG or PNG up to 10 MB · Files are tagged as{" "}
                <span className="font-medium text-foreground">
                  {meta?.attachment_types.find((a) => a.value === selectedDocType)?.label}
                </span>
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="text-muted-foreground">Mandatory checklist:</span>
              {meta?.required_attachments.map((req) => {
                const present = queued.some((q) => q.doc_type === req);
                const reqLabel = meta.attachment_types.find((a) => a.value === req)?.label ?? req;
                return (
                  <Badge key={req} variant={present ? "forest" : "gold"}>
                    {present ? "✓ " : "• "}
                    {reqLabel}
                  </Badge>
                );
              })}
            </div>

            {queued.length > 0 && (
              <ul className="mt-4 divide-y rounded-md border">
                {queued.map((item) => {
                  const typeLabel =
                    meta?.attachment_types.find((a) => a.value === item.doc_type)?.label ??
                    item.doc_type;
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {typeLabel}{" "}
                            <span className="font-normal text-muted-foreground">
                              · {item.file.name}
                            </span>
                          </p>
                          <p className="text-[11.5px] text-muted-foreground">
                            {formatBytes(item.file.size)}
                            {item.note ? ` · ${item.note}` : ""}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setQueued((prev) => prev.filter((q) => q.id !== item.id))}
                      >
                        <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </FormSection>
      )}

      {/* Section C: Declaration */}
      <FormSection
        letter="C"
        title="Statutory Declaration"
        description="In terms of Section 38(a) of the Agricultural Land Settlement Act (Chapter 20:01)."
      >
        <div className="rounded-md border bg-muted/40 p-4 text-[13px] leading-relaxed text-foreground/90">
          <p>
            “I do sincerely declare that the particulars given on this application form are true and
            correct and that I have not withheld any information which might affect my application. I
            am aware of the provision in section 38(a) of the Agricultural Land Settlement Act
            (Chapter 20:01) namely{" "}
            <em className="text-foreground">
              ‘a person who makes a false statement knowing it to be false in connection with an
              application for a holding shall be guilty of an offence and liable to a fine not
              exceeding $200 or in default of payment, to imprisonment of a period not exceeding six
              months’
            </em>
            .”
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Full Name of Declarant (I, ...)"
            required
            error={errors.declaration_name?.message}
          >
            <Input className="uppercase" {...form.register("declaration_name")} />
          </Field>

          <Field label="Date Signed" required error={errors.declaration_date?.message}>
            <Input type="date" max={today} {...form.register("declaration_date")} />
          </Field>
        </div>

        <Controller
          control={form.control}
          name="declaration_signed"
          render={({ field }) => (
            <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-[13px]">
              <Checkbox
                checked={field.value}
                onCheckedChange={(v) => field.onChange(Boolean(v))}
                className="mt-0.5"
              />
              <span>
                The physical or online application form bears the applicant’s signature under Section
                C.
                {errors.declaration_signed && (
                  <span className="block text-[12px] text-destructive">
                    {errors.declaration_signed.message}
                  </span>
                )}
              </span>
            </label>
          )}
        />
      </FormSection>

      <div className="flex items-center justify-end gap-3 pt-6">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <FileText />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

