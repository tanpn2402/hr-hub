import { UndefinedInitialDataOptions, useMutation, useQuery } from '@tanstack/react-query';
import {
  executeFinePayment,
  FinePayment,
  getPaymentDetail,
  getPaymentPreview,
  rejectFinePayment,
  settleFinePayment,
} from '../api/workforce';

type UseQueryOptions<T> = Omit<
  UndefinedInitialDataOptions<T, Error, T, (string | undefined | null)[]>,
  'queryKey' | 'queryFn'
>;

export function useFinePaymentPreview(employeeCode: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['fine-payment-preview', employeeCode],
    queryFn: () => getPaymentPreview(employeeCode!),
    enabled: !!employeeCode && enabled,
  });
}

export function useFinePaymentDetail(
  paymentId: string | null | undefined,
  options?: UseQueryOptions<FinePayment>,
) {
  return useQuery({
    queryKey: ['fine-payment-detail', paymentId],
    queryFn: () => getPaymentDetail(paymentId!),
    enabled: !!paymentId,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    ...options,
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
