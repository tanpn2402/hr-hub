import { apiClient } from '@/api/client';

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  email?: string | null;
  referenceId?: string | null;
  phone?: string | null;
  department?: string | null;
  position?: string | null;
  joinedAt?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getEmployees(): Promise<Employee[]> {
  const { data } = await apiClient.get<Employee[]>('/employees');

  return data;
}

export async function updateEmployee(id: string, input: Partial<Employee>): Promise<Employee> {
  const { data } = await apiClient.patch<Employee>(`/employees/${id}`, input);
  return data;
}
