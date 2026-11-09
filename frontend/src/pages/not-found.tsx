import { Link } from "react-router-dom";

import { EmptyState } from "@/components/page";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="The page you were looking for does not exist or has moved."
      action={
        <Button asChild variant="outline">
          <Link to="/">Back to overview</Link>
        </Button>
      }
    />
  );
}

