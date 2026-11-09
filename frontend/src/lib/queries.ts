import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  Activity,
  ApplicationDetail,
  ApplicationInput,
  ApplicationListItem,
  Attachment,
  Meta,
  Paginated,
  Review,
  Stats,
  User,
} from "@/lib/types";

export const keys = {
  meta: ["meta"] as const,
  stats: ["stats"] as const,
  applications: (params: Record<string, unknown>) => ["applications", params] as const,
  application: (ref: string) => ["application", ref] as const,
  activity: (ref: string) => ["application", ref, "activity"] as const,
  users: (params: Record<string, unknown>) => ["users", params] as const,
};

export function useMeta() {
  return useQuery({
    queryKey: keys.meta,
    queryFn: async () => (await api.get<Meta>("/meta/")).data,
    staleTime: Infinity,
  });
}

/** Lookup helper: label for a value in one of the meta choice lists. */
export function useLabel() {
  const { data } = useMeta();
  return (list: keyof Meta, value?: string | null) => {
    if (!value) return "—";
    const choices = data?.[list];
    if (!Array.isArray(choices)) return value;
    const found = (choices as { value: string; label: string }[]).find((c) => c.value === value);
    return found?.label ?? value;
  };
}

export function useStats() {
  return useQuery({
    queryKey: keys.stats,
    queryFn: async () => (await api.get<Stats>("/stats/")).data,
  });
}

export function useApplications(params: Record<string, unknown>) {
  return useQuery({
    queryKey: keys.applications(params),
    queryFn: async () =>
      (await api.get<Paginated<ApplicationListItem>>("/applications/", { params, paramsSerializer: { indexes: null } }))
        .data,
    placeholderData: keepPreviousData,
  });
}

export function useApplication(ref: string | undefined) {
  return useQuery({
    queryKey: keys.application(ref ?? ""),
    queryFn: async () => (await api.get<ApplicationDetail>(`/applications/${ref}/`)).data,
    enabled: !!ref,
  });
}

export function useActivity(ref: string) {
  return useQuery({
    queryKey: keys.activity(ref),
    queryFn: async () => (await api.get<Activity[]>(`/applications/${ref}/activity/`)).data,
  });
}

function useInvalidateApplication(ref: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["application", ref] });
    qc.invalidateQueries({ queryKey: ["applications"] });
    qc.invalidateQueries({ queryKey: keys.stats });
  };
}

export function useCreateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ApplicationInput) =>
      (await api.post<ApplicationDetail>("/applications/", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: keys.stats });
    },
  });
}

export function useUpdateApplication(ref: string) {
  const invalidate = useInvalidateApplication(ref);
  return useMutation({
    mutationFn: async (payload: Partial<ApplicationInput>) =>
      (await api.patch<ApplicationDetail>(`/applications/${ref}/`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useUploadAttachment(ref: string) {
  const invalidate = useInvalidateApplication(ref);
  return useMutation({
    mutationFn: async (input: {
      file: File;
      doc_type: string;
      note?: string;
      onProgress?: (pct: number) => void;
    }) => {
      const form = new FormData();
      form.append("file", input.file);
      form.append("doc_type", input.doc_type);
      if (input.note) form.append("note", input.note);
      const { data } = await api.post<Attachment>(`/applications/${ref}/attachments/`, form, {
        onUploadProgress: (e) => e.total && input.onProgress?.(Math.round((e.loaded / e.total) * 100)),
      });
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteAttachment(ref: string) {
  const invalidate = useInvalidateApplication(ref);
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/applications/${ref}/attachments/${id}/`),
    onSuccess: invalidate,
  });
}

export function useDecide(ref: string) {
  const invalidate = useInvalidateApplication(ref);
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await api.post<Review>(`/applications/${ref}/decide/`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useApplicationAction(ref: string, action: "resubmit" | "withdraw" | "notes") {
  const invalidate = useInvalidateApplication(ref);
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await api.post(`/applications/${ref}/${action}/`, payload)).data,
    onSuccess: invalidate,
  });
}

/* ---- officers ---- */

export function useUsers(params: Record<string, unknown>) {
  return useQuery({
    queryKey: keys.users(params),
    queryFn: async () => (await api.get<Paginated<User>>("/auth/users/", { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useSaveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<User> & { password?: string }) =>
      id
        ? (await api.patch<User>(`/auth/users/${id}/`, payload)).data
        : (await api.post<User>("/auth/users/", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

