import apiClient from './client';
import type { DashboardStats, Incident } from '../types';

export async function getStats(): Promise<DashboardStats> {
  const response = await apiClient.get<DashboardStats>('/dashboard/stats');
  return response.data;
}

export async function getRecent(limit: number = 5): Promise<Incident[]> {
  const response = await apiClient.get<Incident[]>(`/dashboard/recent?limit=${limit}`);
  return response.data;
}
