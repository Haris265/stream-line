export type User = {
  id: number;
  email: string;
  phone: string;
  role: "admin" | "employee";
  first_name: string;
  last_name: string;
};

export type Shift = {
  id: number;
  user: number;
  user_email?: string;
  clock_in: string;
  clock_out: string | null;
  total_hours: string | number | null;
  total_distance_km: string | number;
  total_miles: number;
  live_hours: number | null;
  is_open: boolean;
  is_on_break?: boolean;
  break_started_at?: string | null;
  total_break_minutes?: string | number;
  client_uuid: string;
};

export type LiveStatus = {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  shift_id: number;
  clock_in: string;
  is_on_break?: boolean;
  live_hours: number;
  total_distance_km: number;
  total_miles: number;
  last_location: {
    latitude: number;
    longitude: number;
    recorded_at: string;
  } | null;
};

export type QueuedPing = {
  client_uuid: string;
  shift_id?: number;
  shift_client_uuid?: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  recorded_at: string;
};

export type QueuedClockIn = {
  client_uuid: string;
  clock_in: string;
};

export type QueuedClockOut = {
  client_uuid?: string;
  shift_id?: number;
  clock_out: string;
};
