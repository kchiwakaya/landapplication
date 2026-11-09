import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const ACCESS_KEY = "mlrd.access";
const REFRESH_KEY = "mlrd.refresh";

export const tokens = {
  get access() {
    return sessionStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return sessionStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    sessionStorage.setItem(ACCESS_KEY, access);
    if (refresh) sessionStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
  },
};

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ""}/api`,
});

api.interceptors.request.use((config) => {
  const access = tokens.access;
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

/* --- Silent refresh: queue concurrent 401s behind a single refresh call --- */
let refreshing: Promise<string> | null = null;
let onSessionExpired: () => void = () => {};

export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

async function refreshAccessToken(): Promise<string> {
  const refresh = tokens.refresh;
  if (!refresh) throw new Error("No refresh token");
  const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh/`, { refresh });
  tokens.set(data.access, data.refresh);
  return data.access as string;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const isAuthCall = original?.url?.includes("/auth/login") || original?.url?.includes("/auth/refresh");
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        refreshing ??= refreshAccessToken().finally(() => (refreshing = null));
        const access = await refreshing;
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch {
        tokens.clear();
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  },
);

/** Turn a DRF error payload into a single readable sentence. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!axios.isAxiosError(error)) return fallback;
  if (!error.response) return "Cannot reach the server. Check your connection.";
  const data = error.response.data as unknown;
  if (typeof data === "string") return fallback;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    if (Array.isArray(record.detail)) return String(record.detail[0]);
    const [field, value] = Object.entries(record)[0] ?? [];
    if (field) {
      const msg = Array.isArray(value) ? value[0] : value;
      if (field === "non_field_errors") return String(msg);
      return `${field.replace(/_/g, " ")}: ${String(msg)}`;
    }
  }
  return fallback;
}

/** Field-level errors from DRF (for react-hook-form setError). */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error) || !error.response?.data || typeof error.response.data !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(error.response.data as Record<string, unknown>)) {
    if (key === "detail") continue;
    out[key] = Array.isArray(value) ? String(value[0]) : String(value);
  }
  return out;
}

/** Fetch a protected file as a blob (attachments are never served publicly). */
export async function fetchBlob(url: string): Promise<Blob> {
  const { data } = await api.get(url, { responseType: "blob" });
  return data as Blob;
}

export async function downloadFile(url: string, filename: string) {
  const blob = await fetchBlob(url);
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

