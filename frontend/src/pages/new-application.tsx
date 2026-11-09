import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { ApplicationForm, type QueuedAttachment } from "@/components/application-form";
import { PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, errorMessage } from "@/lib/api";
import { useCreateApplication } from "@/lib/queries";
import type { ApplicationInput } from "@/lib/types";

export default function NewApplicationPage() {
  const navigate = useNavigate();
  const create = useCreateApplication();

  async function handleSubmit(values: ApplicationInput, attachments: QueuedAttachment[]) {
    try {
      const created = await create.mutateAsync(values);
      // Upload any queued attachments (e.g. National ID, 5-year cash flow)
      for (const item of attachments) {
        const form = new FormData();
        form.append("file", item.file);
        form.append("doc_type", item.doc_type);
        if (item.note) form.append("note", item.note);
        try {
          await api.post(`/applications/${created.reference}/attachments/`, form);
        } catch (uploadErr) {
          toast.error(
            errorMessage(uploadErr, `Application saved, but failed to attach ${item.file.name}.`),
          );
        }
      }
      toast.success(
        `Application ${created.application_no} captured and receipt notification sent to farmer.`,
      );
      navigate(`/applications/${created.reference}`);
    } catch (err) {
      toast.error(errorMessage(err, "Please check the highlighted fields."));
      throw err;
    }
  }

  return (
    <div>
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/applications">
            <ArrowLeft /> Back to register
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="Phase II, Model A2 · Agricultural Land Settlement Act (Chapter 20:01)"
        title="Capture Application for Land"
        description="Complete Sections A, B and C in full and attach the applicant’s National ID and five-year cash flow projection."
      />

      <Card>
        <CardContent className="py-6">
          <ApplicationForm
            allowAttachments
            submitLabel="Register application"
            onSubmit={handleSubmit}
            onCancel={() => navigate("/applications")}
          />
        </CardContent>
      </Card>
    </div>
  );
}

