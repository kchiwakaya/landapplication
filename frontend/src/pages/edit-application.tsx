import { ArrowLeft } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { ApplicationForm } from "@/components/application-form";
import { PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { useApplication, useUpdateApplication } from "@/lib/queries";
import type { ApplicationInput } from "@/lib/types";

export default function EditApplicationPage() {
  const { reference } = useParams<{ reference: string }>();
  const navigate = useNavigate();
  const { data: app, isLoading } = useApplication(reference);
  const update = useUpdateApplication(reference ?? "");

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!app) return <Navigate to="/applications" replace />;
  if (!app.permissions.edit) return <Navigate to={`/applications/${app.reference}`} replace />;

  async function handleSubmit(values: ApplicationInput) {
    try {
      await update.mutateAsync(values);
      toast.success("Application particulars updated.");
      navigate(`/applications/${app?.reference}`);
    } catch (err) {
      toast.error(errorMessage(err, "Could not update application."));
      throw err;
    }
  }

  return (
    <div>
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to={`/applications/${app.reference}`}>
            <ArrowLeft /> Back to {app.application_no}
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={`Form No. ${app.application_no}`}
        title={`Edit Particulars · ${app.full_name}`}
        description="Amendments are logged in the application’s permanent audit trail."
      />

      <Card>
        <CardContent className="py-6">
          <ApplicationForm
            defaultValues={app}
            submitLabel="Save changes"
            onSubmit={handleSubmit}
            onCancel={() => navigate(`/applications/${app.reference}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

