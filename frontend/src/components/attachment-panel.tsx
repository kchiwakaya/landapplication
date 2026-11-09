import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Field } from "@/components/field";
import { EmptyState } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { downloadFile, errorMessage, fetchBlob } from "@/lib/api";
import { formatBytes, formatDateTime } from "@/lib/format";
import { useDeleteAttachment, useMeta, useUploadAttachment } from "@/lib/queries";
import type { ApplicationDetail, Attachment } from "@/lib/types";

function AttachmentPreviewDialog({
  reference,
  attachment,
  onClose,
}: {
  reference: string;
  attachment: Attachment | null;
  onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!attachment) {
      setBlobUrl(null);
      return;
    }
    let active = true;
    let createdUrl: string | null = null;
    setLoading(true);
    fetchBlob(`/applications/${reference}/attachments/${attachment.id}/file/?inline=1`)
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      })
      .catch((err) => {
        toast.error(errorMessage(err, "Could not load attachment preview."));
        onClose();
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [attachment, reference, onClose]);

  return (
    <Dialog open={!!attachment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{attachment?.doc_type_display}</DialogTitle>
          <DialogDescription>
            {attachment?.original_name} · {attachment ? formatBytes(attachment.size) : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-[480px] overflow-hidden rounded-md border bg-muted/40">
          {loading || !blobUrl ? (
            <div className="flex h-[480px] items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : attachment?.content_type.startsWith("image/") ? (
            <div className="flex max-h-[70vh] items-center justify-center overflow-auto p-4">
              <img
                src={blobUrl}
                alt={attachment.original_name}
                className="max-h-[65vh] rounded object-contain"
              />
            </div>
          ) : (
            <iframe
              src={blobUrl}
              title={attachment?.original_name}
              className="h-[70vh] w-full border-0"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AttachmentPanel({ application }: { application: ApplicationDetail }) {
  const { data: meta } = useMeta();
  const upload = useUploadAttachment(application.reference);
  const remove = useDeleteAttachment(application.reference);

  const [docType, setDocType] = useState<string>(
    application.missing_attachments[0] || "national_id",
  );
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<Attachment | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    disabled: !application.permissions.upload || upload.isPending,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxSize: 10 * 1024 * 1024,
    onDropAccepted: async (files) => {
      for (const file of files) {
        try {
          setProgress(0);
          await upload.mutateAsync({
            file,
            doc_type: docType,
            note: note.trim(),
            onProgress: setProgress,
          });
          toast.success(`Uploaded ${file.name}`);
          setNote("");
        } catch (err) {
          toast.error(errorMessage(err, `Failed to upload ${file.name}`));
        } finally {
          setProgress(null);
        }
      }
    },
    onDropRejected: (rejections) => {
      const msg = rejections[0]?.errors[0]?.message || "Unsupported file (PDF, JPG, PNG up to 10MB).";
      toast.error(msg);
    },
  });

  const presentTypes = new Set(application.attachments.map((a) => a.doc_type));

  return (
    <div className="grid gap-5">
      {/* Checklist of statutory documents */}
      <Card>
        <CardHeader>
          <CardTitle>Statutory Attachment Checklist</CardTitle>
          <span className="text-[12px] text-muted-foreground">
            Section B (Item 7) & National ID verification
          </span>
        </CardHeader>
        <CardContent className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { code: "national_id", label: "National ID", required: true },
            { code: "cash_flow", label: "5-Year Cash Flow Projection", required: true },
            { code: "training", label: "Proof of Training / Experience", required: false },
            { code: "funds", label: "Proof of Funds / Movable Assets", required: false },
          ].map((item) => {
            const onFile = presentTypes.has(item.code);
            return (
              <div
                key={item.code}
                onClick={() => application.permissions.upload && setDocType(item.code)}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-3 transition-colors ${
                  onFile
                    ? "border-forest-700/30 bg-forest-100/40"
                    : item.required
                      ? "border-gold/50 bg-gold-soft/30"
                      : "bg-card hover:bg-muted/40"
                }`}
              >
                <CheckCircle2
                  className={`mt-0.5 size-4 shrink-0 ${
                    onFile ? "text-forest-700" : "text-muted-foreground/40"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium leading-snug">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {onFile ? "On file" : item.required ? "Required before Committee" : "Added advantage"}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Upload box */}
      {application.permissions.upload && (
        <Card>
          <CardHeader>
            <CardTitle>Add Attachment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Document Category">
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meta?.attachment_types.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Officer Note / Description">
                <Input
                  placeholder="Optional note (e.g. Certified copy, Agribank letter)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
            </div>

            <div
              {...getRootProps()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-7 text-center transition-colors ${
                isDragActive ? "border-primary bg-forest-100/40" : "border-input hover:bg-muted/40"
              }`}
            >
              <input {...getInputProps()} />
              {upload.isPending ? (
                <>
                  <Loader2 className="mb-2 size-5 animate-spin text-primary" />
                  <p className="text-[13px] font-medium">
                    Uploading{progress != null ? ` (${progress}%)` : "..."}
                  </p>
                </>
              ) : (
                <>
                  <Upload className="mb-2 size-5 text-muted-foreground" />
                  <p className="text-[13px] font-medium">
                    Drop PDF, JPG or PNG here, or <span className="text-primary underline">browse</span>
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    Maximum 10 MB per file · Stored in confidential Ministry repository
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing attachments list */}
      <Card>
        <CardHeader>
          <CardTitle>Filed Documents ({application.attachments.length})</CardTitle>
        </CardHeader>
        {application.attachments.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title="No attachments on file"
            description="Upload the applicant's National ID and five-year cash flow projection above."
          />
        ) : (
          <ul className="divide-y">
            {application.attachments.map((att) => {
              const isImage = att.content_type.startsWith("image/");
              return (
                <li
                  key={att.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded border bg-muted/50 text-muted-foreground">
                      {isImage ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-medium">{att.doc_type_display}</span>
                        <Badge variant="outline">{att.original_name}</Badge>
                      </div>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {formatBytes(att.size)} · Uploaded by {att.uploaded_by.full_name} on{" "}
                        {formatDateTime(att.uploaded_at)}
                        {att.note ? ` · “${att.note}”` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => setPreview(att)}>
                      <Eye /> View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        downloadFile(
                          `/applications/${application.reference}/attachments/${att.id}/file/`,
                          att.original_name,
                        ).catch((err) => toast.error(errorMessage(err)))
                      }
                    >
                      <Download /> Download
                    </Button>
                    {application.permissions.upload && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={remove.isPending}
                        onClick={async () => {
                          try {
                            await remove.mutateAsync(att.id);
                            toast.success("Attachment removed");
                          } catch (err) {
                            toast.error(errorMessage(err));
                          }
                        }}
                      >
                        <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <AttachmentPreviewDialog
        reference={application.reference}
        attachment={preview}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

