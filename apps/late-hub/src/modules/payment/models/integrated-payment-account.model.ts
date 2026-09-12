export type IntegratedPaymentProvider = 'APIPAY';

export class IntegratedPaymentAccount {
  constructor(
    readonly provider: IntegratedPaymentProvider,
    readonly accessKey: string,
    readonly secretKey: string,
    readonly bankPublicId: string,
  ) {}

  authorizationHeader(): string {
    const credentials = Buffer.from(`${this.accessKey}:${this.secretKey}`).toString('base64');
    return `Bearer ${credentials}`;
  }
}
