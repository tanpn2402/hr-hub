import { useMutation, useQuery } from '@tanstack/react-query';
import {
  executeFinePayment,
  getPaymentPreview,
  rejectFinePayment,
  settleFinePayment,
} from '../api/workforce';

export function useFinePaymentPreview(employeeCode: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['fine-payment-preview', employeeCode],
    queryFn: () => getPaymentPreview(employeeCode!),
    enabled: !!employeeCode && enabled,
  });
}

export function useSettleFinePaymentMutation() {
  return useMutation({
    mutationFn: settleFinePayment,
  });
}

export function useRejectFinePaymentMutation() {
  return useMutation({
    mutationFn: rejectFinePayment,
  });
}

export function useExecuteFinePaymentMutation() {
  return useMutation({
    mutationFn: executeFinePayment,
  });
}
