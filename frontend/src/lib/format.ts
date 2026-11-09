import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

export function formatDate(value?: string | null, pattern = "d MMM yyyy") {
  if (!value) return "—";
  try {
    return format(parseISO(value), pattern);
  } catch {
    return value;
  }
}

export function formatDateTime(value?: string | null) {
  return formatDate(value, "d MMM yyyy, HH:mm");
}

export function timeAgo(value?: string | null) {
  if (!value) return "—";
  return `${formatDistanceToNowStrict(parseISO(value))} ago`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

