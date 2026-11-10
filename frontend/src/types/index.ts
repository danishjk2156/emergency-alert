export type Role = 'admin' | 'responder' | 'reporter';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role?: Role;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'reported' | 'investigating' | 'in_progress' | 'resolved' | 'closed';
export type IncidentCategory =
  | 'fire'
  | 'medical'
  | 'natural_disaster'
  | 'hazmat'
  | 'infrastructure'
  | 'security'
  | 'traffic'
  | 'other';

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Incident {
  id: number;
  title: string;
  description: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  location: Location;
  reported_by: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  updates?: IncidentUpdate[];
}

export interface IncidentCreate {
  title: string;
  description: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  location: Location;
}

export interface IncidentUpdateRequest {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  assigned_to?: string;
}

export interface IncidentUpdate {
  id: number;
  incident_id: number;
  message: string;
  author: string;
  created_at: string;
  status_change?: string;
}

export interface IncidentUpdateCreate {
  message: string;
}

export interface DashboardStats {
  total_incidents: number;
  open_incidents: number;
  in_progress_incidents: number;
  resolved_incidents: number;
  critical_incidents: number;
  incidents_by_severity: Record<string, number>;
  incidents_by_category: Record<string, number>;
  incidents_by_status: Record<string, number>;
}

export interface IncidentFilters {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  category?: IncidentCategory;
}
