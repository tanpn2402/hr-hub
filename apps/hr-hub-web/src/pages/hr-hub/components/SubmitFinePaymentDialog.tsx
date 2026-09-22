import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import {
  Check,
  Copy,
} from "lucide-react";

import type {
  EmployeeSummary,
  WorkforceImportResult,
} from "./LateHubReviewTable";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

type Props = {
  paymentEmployee: EmployeeSummary | null;
  onOpenChange: (open: boolean) => void;
};

type PaymentPayload = {
  employeeCode: string;
};

type PaymentQrResponse = {
  qrCode?: string;
  qrUrl?: string;
  amount?: number;
  description?: string;
};

async function createPaymentQrCode(payload: PaymentPayload) {
  const { data } = await axios.post<PaymentQrResponse>(
    "/payment/qr-code",
    payload,
  );

  return data;
}

function useCreatePaymentQrCodeMutation() {
  return useMutation({
    mutationFn: createPaymentQrCode,
  });
}

export function SubmitFinePaymentDialog({ paymentEmployee, onOpenChange }: Props) {
  const paymentMutation = useCreatePaymentQrCodeMutation();

  const paymentQr = paymentMutation.data?.qrCode ?? paymentMutation.data?.qrUrl;

  return (
    <Dialog
      open={!!paymentEmployee}
      onOpenChange={(open) => {
        if (!open && !paymentMutation.isPending) {
          onOpenChange(false);
          paymentMutation.reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thanh toán tiền phạt</DialogTitle>

          <DialogDescription>
            {paymentEmployee?.employeeName} (
            {paymentEmployee?.employeeCode})
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-56 flex-col items-center justify-center py-4">
          {paymentMutation.isPending && (
            <div className="text-sm text-muted-foreground">
              Đang tạo mã QR...
            </div>
          )}

          {paymentMutation.isError && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-destructive">
                Không thể tạo mã QR thanh toán.
              </p>

              <Button
                variant="outline"
                onClick={() => {
                  if (!paymentEmployee) return;

                  paymentMutation.mutate({
                    employeeCode: paymentEmployee.employeeCode,
                  });
                }}
              >
                Thử lại
              </Button>
            </div>
          )}

          {!paymentMutation.isPending &&
            !paymentMutation.isError &&
            paymentQr && (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <img
                    src={paymentQr}
                    alt="QR thanh toán"
                    className="h-64 w-64 rounded-lg border object-contain"
                  />
                </div>

                {paymentMutation.data?.amount != null && (
                  <div className="font-mono text-lg font-bold">
                    {formatMoney(paymentMutation.data.amount)}
                  </div>
                )}

                {paymentMutation.data?.description && (
                  <p className="text-sm text-muted-foreground">
                    {paymentMutation.data.description}
                  </p>
                )}
              </div>
            )}

          {!paymentMutation.isPending &&
            !paymentMutation.isError &&
            !paymentQr && (
              <div className="text-sm text-muted-foreground">
                API không trả về mã QR.
              </div>
            )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Đóng
          </Button>

          {paymentQr && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(paymentQr);
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy QR URL
            </Button>
          )}

          {paymentQr && (
            <Button
              type="button"
              onClick={() => {
                window.open(paymentQr, "_blank", "noopener,noreferrer");
              }}
            >
              <Check className="mr-2 h-4 w-4" />
              Mở thanh toán
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}