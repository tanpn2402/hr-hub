export interface GenerateQrRequest {
  content: string;
  amount: number;
}

export interface GenerateQrResult {
  publicId: string;
  payUrl: string;
  qrUrl: string;
  bankCode: string;
  accountNumber: string;
  amount: number;
  content: string;
}

export interface IntegratedPaymentProvider {
  generateQr(request: GenerateQrRequest): Promise<GenerateQrResult>;
  isTransactionFullyFilled(externalId: string): Promise<boolean>;
}
