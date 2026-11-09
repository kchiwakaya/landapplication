import { cn } from "@/lib/utils";
import type { Status } from "@/lib/types";

const STYLES: Record<Status, { dot: string; text: string; label: string }> = {
  received: { dot: "bg-[#5b7fa6]", text: "text-[#33557a]", label: "Received" },
  queried: { dot: "bg-gold", text: "text-[#80570c]", label: "Queried" },
  committee: { dot: "bg-[#7a6aa8]", text: "text-[#4f4380]", label: "With Committee" },
  board: { dot: "bg-[#3f8a8a]", text: "text-[#246464]", label: "With Board" },
  minister: { dot: "bg-[#b0782d]", text: "text-[#7d5218]", label: "With Minister" },
  approved: { dot: "bg-forest-700", text: "text-forest-700", label: "Approved" },
  rejected: { dot: "bg-earth", text: "text-earth", label: "Rejected" },
  withdrawn: { dot: "bg-muted-foreground/60", text: "text-muted-foreground", label: "Withdrawn" },
};

export function statusLabel(status: Status) {
  return STYLES[status]?.label ?? status;
}

export function statusDot(status: Status) {
  return STYLES[status]?.dot ?? "bg-muted-foreground";
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const style = STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12.5px] font-medium", style.text, className)}>
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}

