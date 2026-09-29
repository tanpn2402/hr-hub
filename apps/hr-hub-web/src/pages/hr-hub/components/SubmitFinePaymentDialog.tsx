import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Loader2,
} from "lucide-react";

import type { EmployeeSummary } from "./LateHubReviewTable";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { formatMonth } from "@/lib/time-utils";
import { FinePayment, FinePaymentPreviewResponse } from "../api/workforce";

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

type ExecutePaymentPayload = {
  employeeCode: string;
  monthlyFineIds: string[];
};

type Step = "preview" | "detail";

/*
 * --------------------------------------------------------------------------
 * API
 * --------------------------------------------------------------------------
 */

async function getPaymentPreview(
  employeeCode: string,
): Promise<FinePaymentPreviewResponse> {
  const { data } =
    await axios.get<FinePaymentPreviewResponse>(
      "/api/fines/payment/preview",
      {
        params: {
          employeeCode,
        },
      },
    );

  return data;
}

async function executeFinePayment(
  payload: ExecutePaymentPayload,
): Promise<FinePayment> {
  const { data } =
    await axios.post<FinePayment>(
      "/api/fines/payment",
      payload,
    );

  return data;
}

/*
 * --------------------------------------------------------------------------
 * Hooks
 * --------------------------------------------------------------------------
 */

function useFinePaymentPreview(
  employeeCode: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [
      "fine-payment-preview",
      employeeCode,
    ],
    queryFn: () =>
      getPaymentPreview(employeeCode!),
    enabled: !!employeeCode && enabled,
  });
}

function useExecuteFinePaymentMutation() {
  return useMutation({
    mutationFn: executeFinePayment,
  });
}

/*
 * --------------------------------------------------------------------------
 * Preview Step
 * --------------------------------------------------------------------------
 */

function PreviewStep({
  preview,
  selectedIds,
  onSelectedIdsChange,
  onViewPendingPayment,
}: {
  preview: FinePaymentPreviewResponse;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onViewPendingPayment: (
    payment: FinePayment,
  ) => void;
}) {
  const { t } = useTranslation();

  const pendingPayment =
    preview.pendingTransactions[0] ?? null;

  const selectedFines = useMemo(
    () =>
      preview.availableMonthlyFines.filter(
        (item) =>
          selectedIds.includes(item.id),
      ),
    [
      preview.availableMonthlyFines,
      selectedIds,
    ],
  );

  const totalAmount =
    selectedFines.reduce(
      (sum, item) =>
        sum + item.payableAmount,
      0,
    );

  const allSelected =
    preview.availableMonthlyFines.length > 0 &&
    selectedIds.length ===
    preview.availableMonthlyFines.length;

  const toggleAll = () => {
    if (allSelected) {
      onSelectedIdsChange([]);
      return;
    }

    onSelectedIdsChange(
      preview.availableMonthlyFines.map(
        (item) => item.id,
      ),
    );
  };

  const toggleItem = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectedIdsChange(
        selectedIds.filter(
          (item) => item !== id,
        ),
      );
      return;
    }

    onSelectedIdsChange([
      ...selectedIds,
      id,
    ]);
  };

  return (
    <div className="space-y-4">
      {pendingPayment && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-yellow-900">
                {t(
                  "employee_has_pending_payment",
                )}
              </div>

              <div className="mt-1 text-sm text-yellow-800">
                {formatMoney(
                  pendingPayment.amount,
                )}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onViewPendingPayment(
                  pendingPayment,
                )
              }
            >
              {t("view_transaction")}
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">
            {t("monthly_fines")}
          </div>

          <div className="text-sm text-muted-foreground">
            {t("select_months_to_pay")}
          </div>
        </div>

        {preview.availableMonthlyFines.length >
          0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleAll}
            >
              {allSelected
                ? t("deselect_all")
                : t("select_all")}
            </Button>
          )}
      </div>

      {preview.availableMonthlyFines.length ===
        0 ? (
        <div className="flex min-h-48 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          {t("no_available_fines")}
        </div>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {preview.availableMonthlyFines.map(
            (monthlyFine) => {
              const selected =
                selectedIds.includes(
                  monthlyFine.id,
                );

              return (
                <label
                  key={monthlyFine.id}
                  className={[
                    "flex items-center gap-3 rounded-lg border p-3",
                    "cursor-pointer hover:bg-muted/50",
                  ].join(" ")}
                >
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() =>
                      toggleItem(
                        monthlyFine.id,
                      )
                    }
                  />

                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {formatMonth(
                        monthlyFine.month,
                        "MMMM, YYYY"
                      )}
                    </div>

                    {monthlyFine.reductionAmount >
                      0 && (
                        <div className="text-sm text-muted-foreground">
                          {t("reduction")}:{" "}
                          {formatMoney(
                            monthlyFine.reductionAmount,
                          )}
                        </div>
                      )}
                  </div>

                  <div className="font-mono font-semibold">
                    {formatMoney(
                      monthlyFine.payableAmount,
                    )}
                  </div>
                </label>
              );
            },
          )}
        </div>
      )}

      <div className="rounded-lg bg-muted p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">
            {t("total")}
          </span>

          <span className="font-mono text-xl font-bold">
            {formatMoney(totalAmount)}
          </span>
        </div>

        <div className="mt-1 text-right text-sm text-muted-foreground">
          {t("selected_months")}:{" "}
          {selectedIds.length}
        </div>
      </div>
    </div>
  );
}

/*
 * --------------------------------------------------------------------------
 * Transaction Detail Step
 * --------------------------------------------------------------------------
 */

function PaymentDetailStep({
  payment,
}: {
  payment: FinePayment;
}) {
  const { t } = useTranslation();

  const qrUrl = useMemo(() => (payment.providerMetadata ? JSON.parse(payment.providerMetadata) : { qrUrl: null }).qrUrl, [payment])

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center">
        {qrUrl ? (
          <img
            src={qrUrl}
            alt={t("payment_qr")}
            className="h-64 w-64 rounded-lg border object-contain"
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-lg border text-sm text-muted-foreground">
            {t("payment_qr_missing")}
          </div>
        )}
      </div>

      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm text-muted-foreground">
            {t("amount")}
          </span>

          <span className="font-mono font-bold">
            {formatMoney(payment.amount)}
          </span>
        </div>

        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm text-muted-foreground">
            {t("status")}
          </span>

          <span className="font-medium">
            {payment.status}
          </span>
        </div>

        {payment.paymentMethod && (
          <div className="flex items-center justify-between p-3">
            <span className="text-sm text-muted-foreground">
              {t("payment_method")}
            </span>

            <span>
              {payment.paymentMethod}
            </span>
          </div>
        )}

        {/* {payment.provider && (
          <div className="flex items-center justify-between border-b p-3">
            <span className="text-sm text-muted-foreground">
              {t("provider")}
            </span>

            <span>
              {payment.provider}
            </span>
          </div>
        )} */}

        {payment.providerPaymentId && (
          <div className="flex items-center justify-between p-3">
            <span className="text-sm text-muted-foreground">
              {t("provider_payment_id")}
            </span>

            <span className="max-w-[60%] truncate font-mono text-sm">
              {payment.providerPaymentId}
            </span>
          </div>
        )}
      </div>

      {payment.description && (
        <p className="text-center text-sm text-muted-foreground">
          {payment.description}
        </p>
      )}
    </div>
  );
}

/*
 * --------------------------------------------------------------------------
 * Dialog
 * --------------------------------------------------------------------------
 */

export function SubmitFinePaymentDialog({
  paymentEmployee,
  onOpenChange,
}: Props) {
  const { t } = useTranslation();

  const [step, setStep] =
    useState<Step>("preview");

  const [selectedIds, setSelectedIds] =
    useState<string[]>([]);

  const [paymentDetail, setPaymentDetail] =
    useState<FinePayment | null>(null);

  const previewQuery =
    useFinePaymentPreview(
      paymentEmployee?.employeeCode,
      !!paymentEmployee,
    );

  const paymentMutation =
    useExecuteFinePaymentMutation();

  const pendingPayment =
    previewQuery.data
      ?.pendingTransactions[0] ?? null;

  const hasPendingPayment =
    !!pendingPayment;

  const totalAmount = useMemo(() => {
    if (!previewQuery.data) {
      return 0;
    }

    return previewQuery.data.availableMonthlyFines
      .filter((item) =>
        selectedIds.includes(item.id),
      )
      .reduce(
        (sum, item) =>
          sum + item.payableAmount,
        0,
      );
  }, [
    previewQuery.data,
    selectedIds,
  ]);

  /*
   * Select all available monthly fines
   * when preview is loaded.
   */
  useEffect(() => {
    if (!previewQuery.data) {
      return;
    }

    if (
      previewQuery.data.pendingTransactions
        .length > 0
    ) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(
      previewQuery.data.availableMonthlyFines.map(
        (item) => item.id,
      ),
    );
  }, [previewQuery.data]);

  /*
   * Reset everything when employee changes.
   */
  useEffect(() => {
    setStep("preview");
    setSelectedIds([]);
    setPaymentDetail(null);
    paymentMutation.reset();
  }, [
    paymentEmployee?.employeeCode,
  ]);

  const handleViewPendingPayment = (
    payment: FinePayment,
  ) => {
    setPaymentDetail(payment);
    setStep("detail");
  };

  const handleExecute = () => {
    if (!paymentEmployee) {
      return;
    }

    if (!selectedIds.length) {
      return;
    }

    paymentMutation.mutate(
      {
        employeeCode:
          paymentEmployee.employeeCode,
        monthlyFineIds: selectedIds,
      },
      {
        onSuccess: (payment) => {
          setPaymentDetail(payment);
          setStep("detail");
        },
      },
    );
  };

  const handleBackToPreview = () => {
    setPaymentDetail(null);
    setStep("preview");
  };

  const handleClose = () => {
    if (
      previewQuery.isFetching ||
      paymentMutation.isPending
    ) {
      return;
    }

    setStep("preview");
    setSelectedIds([]);
    setPaymentDetail(null);
    paymentMutation.reset();

    onOpenChange(false);
  };

  const paymentQr =
    paymentDetail?.qrCode ??
    paymentDetail?.qrUrl;

  return (
    <Dialog
      open={!!paymentEmployee}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "detail"
              ? t("payment_transaction")
              : t("fine_payment")}
          </DialogTitle>

          <DialogDescription>
            {paymentEmployee?.employeeName} (
            {paymentEmployee?.employeeCode})
          </DialogDescription>
        </DialogHeader>

        {step === "preview" && (
          <>
            {previewQuery.isLoading && (
              <div className="flex min-h-56 items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("loading")}
                </div>
              </div>
            )}

            {previewQuery.isError && (
              <div className="flex min-h-56 flex-col items-center justify-center gap-3">
                <p className="text-sm text-destructive">
                  {t("payment_preview_failed")}
                </p>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    previewQuery.refetch()
                  }
                >
                  {t("retry")}
                </Button>
              </div>
            )}

            {previewQuery.data && (
              <PreviewStep
                preview={previewQuery.data}
                selectedIds={selectedIds}
                onSelectedIdsChange={
                  setSelectedIds
                }
                onViewPendingPayment={
                  handleViewPendingPayment
                }
              />
            )}

            {paymentMutation.isError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {axios.isAxiosError(
                  paymentMutation.error,
                )
                  ? paymentMutation.error.response
                    ?.data?.message ??
                  t("payment_failed")
                  : t("payment_failed")}
              </div>
            )}
          </>
        )}

        {step === "detail" &&
          paymentDetail && (
            <PaymentDetailStep
              payment={paymentDetail}
            />
          )}

        <DialogFooter>
          {step === "preview" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-w-32"
                disabled={
                  previewQuery.isFetching ||
                  paymentMutation.isPending
                }
                onClick={handleClose}
              >
                {t("close")}
              </Button>

              <Button
                type="button"
                className="min-w-32"
                disabled={
                  !selectedIds.length ||
                  totalAmount <= 0 ||
                  previewQuery.isLoading ||
                  paymentMutation.isPending
                }
                onClick={handleExecute}
              >
                {t("create_payment")}

                {paymentMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
              </Button>
            </>
          )}

          {step === "detail" && paymentDetail && (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-w-32"
                onClick={handleBackToPreview}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                {t("back")}
              </Button>

              {paymentQr && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-32"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      paymentQr,
                    );
                  }}
                >
                  <Copy className="mr-1 h-4 w-4" />
                  {t("copy_qr_url")}
                </Button>
              )}

              {paymentQr && (
                <Button
                  type="button"
                  className="min-w-32"
                  onClick={() => {
                    window.open(
                      paymentQr,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                >
                  <Check className="mr-2 h-4 w-4" />
                  {t("open_payment")}
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                className="min-w-32"
                onClick={handleClose}
              >
                {t("close")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}