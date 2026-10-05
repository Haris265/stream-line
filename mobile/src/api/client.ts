import { tokenStorage } from "../storage/tokens";
import type { LiveStatus, Shift, User } from "../types";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000/api";

type LoginResponse = {
  access: string;
  refresh: string;
  user: User;
};

async function authHeaders(): Promise<Record<string, string>> {
  const access = await tokenStorage.getAccess();
  return {
    "Content-Type": "application/json",
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
  };
}

async function refreshAccess(): Promise<boolean> {
  const refresh = await tokenStorage.getRefresh();
  if (!refresh) return false;
  const res = await fetch(`${API_URL}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { access: string; refresh?: string };
  await tokenStorage.setTokens(data.access, data.refresh || refresh);
  return true;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const headers = {
    ...(await authHeaders()),
    ...(options.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const ok = await refreshAccess();
    if (ok) return request<T>(path, options, false);
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  login(email: string, password: string) {
    return request<LoginResponse>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }, false);
  },
  me() {
    return request<User>("/auth/me/");
  },
  clockIn(payload?: { client_uuid?: string; clock_in?: string }) {
    return request<Shift>("/shifts/clock-in/", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },
  clockOut(shiftId: number, clock_out?: string) {
    return request<Shift>(`/shifts/${shiftId}/clock-out/`, {
      method: "POST",
      body: JSON.stringify(clock_out ? { clock_out } : {}),
    });
  },
  startBreak(shiftId: number) {
    return request<Shift>(`/shifts/${shiftId}/break/start/`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  endBreak(shiftId: number) {
    return request<Shift>(`/shifts/${shiftId}/break/end/`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  deleteAccount() {
    return request<void>("/auth/me/", { method: "DELETE" });
  },
  currentShift() {
    return request<{ shift: Shift | null }>("/shifts/current/");
  },
  listShifts(userId?: number) {
    const q = userId ? `?user=${userId}` : "";
    return request<Shift[]>(`/shifts/${q}`);
  },
  sendPings(
    shiftId: number,
    pings: Array<{
      client_uuid: string;
      latitude: number;
      longitude: number;
      accuracy?: number | null;
      speed?: number | null;
      recorded_at: string;
    }>
  ) {
    return request<{ created: number; shift: Shift }>(
      `/shifts/${shiftId}/pings/`,
      {
        method: "POST",
        body: JSON.stringify({ pings }),
      }
    );
  },
  syncBatch(body: {
    clock_ins?: unknown[];
    clock_outs?: unknown[];
    pings?: unknown[];
  }) {
    return request<{
      shifts: Shift[];
      clock_outs: Shift[];
      pings_created: number;
    }>("/sync/batch/", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  liveStatus() {
    return request<LiveStatus[]>("/admin/live-status/");
  },
  async exportCsv(start?: string, end?: string) {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    const qs = params.toString();
    const access = await tokenStorage.getAccess();
    const res = await fetch(
      `${API_URL}/admin/export/csv/${qs ? `?${qs}` : ""}`,
      {
        headers: access ? { Authorization: `Bearer ${access}` } : {},
      }
    );
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    return res.text();
  },
};
