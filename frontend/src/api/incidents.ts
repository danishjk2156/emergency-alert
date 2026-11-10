import apiClient from './client';
import type {
  Incident,
  IncidentCreate,
  IncidentUpdateRequest,
  IncidentUpdate,
  IncidentUpdateCreate,
  IncidentFilters,
} from '../types';

export async function listIncidents(filters?: IncidentFilters): Promise<Incident[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.severity) params.append('severity', filters.severity);
  if (filters?.category) params.append('category', filters.category);

  const response = await apiClient.get<Incident[]>('/incidents', { params });
  return response.data;
}

export async function getIncident(id: number): Promise<Incident> {
  const response = await apiClient.get<Incident>(`/incidents/${id}`);
  return response.data;
}

export async function createIncident(data: IncidentCreate): Promise<Incident> {
  const response = await apiClient.post<Incident>('/incidents', data);
  return response.data;
}

export async function updateIncident(id: number, data: IncidentUpdateRequest): Promise<Incident> {
  const response = await apiClient.put<Incident>(`/incidents/${id}`, data);
  return response.data;
}

export async function addIncidentUpdate(id: number, data: IncidentUpdateCreate): Promise<IncidentUpdate> {
  const response = await apiClient.post<IncidentUpdate>(`/incidents/${id}/updates`, data);
  return response.data;
}

export async function deleteIncident(id: number): Promise<void> {
  await apiClient.delete(`/incidents/${id}`);
}
