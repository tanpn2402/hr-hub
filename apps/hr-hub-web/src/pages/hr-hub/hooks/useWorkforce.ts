import { useQuery } from '@tanstack/react-query';
import { getAvailableMonths, getMonthlyReport } from '../api/workforce';

export function useMonthlyReport(currentMonth: string | null) {
  return useQuery({
    queryKey: ['workforce', 'report', currentMonth],
    queryFn: () => getMonthlyReport(currentMonth ?? ''),
    enabled: Boolean(currentMonth),
    refetchOnWindowFocus: true,
  });
}

export function useAvailableMonths() {
  return useQuery({
    queryKey: ['workforce', 'report-months'],
    queryFn: () => getAvailableMonths(),
    refetchOnWindowFocus: true,
  });
}
