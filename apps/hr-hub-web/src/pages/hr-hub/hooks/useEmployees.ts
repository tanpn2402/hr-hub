import { useQuery } from '@tanstack/react-query';
import { getEmployees } from '../api/employees';

export const employeesQueryKey = ['employees'] as const;

export function useEmployees() {
  return useQuery({
    queryKey: employeesQueryKey,
    queryFn: getEmployees,
  });
}
