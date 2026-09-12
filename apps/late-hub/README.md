# LateHub

Employee portal backend for checking late hours and submitting attendance fines.

The project name `LateHub` describes the product domain. Payment providers are an integration detail: the current first slice generates an Apipay QR code so an employee can settle a fine, while future modules can add late-hour records, fine calculation, and employee workflows.

## Scope

- HTTP server with environment configuration
- Console and daily-rotating file logging
- Payment provider abstraction selected at runtime
- One current payment endpoint: `POST /payment/qr`
- Two-file Excel workforce import endpoint: `POST /workforce/import`
- Apipay integration only
- No database, Prisma, queue, webhook, or background worker
- Provider abstraction for future integrated-payment providers such as PayOS

## Planned Domain Modules

- `attendance`: employee late-hour records
- `fine`: fine calculation and submission workflow
- `payment`: payment-provider integration for settling fines

## Setup

```bash
cp .env.example .env
npm install
npm run start:dev
```

Set these values in `.env` before calling Apipay:

- `APIPAY_HOST`
- `APIPAY_ACCESS_KEY`
- `APIPAY_SECRET_KEY`
- `APIPAY_BANK_PUBLIC_ID`

## Generate a QR

```bash
curl -X POST http://localhost:3000/payment/qr \
  -H 'Content-Type: application/json' \
  -d '{"content":"ORDER-123","amount":100000}'
```

The response contains the Apipay payment identifier and QR URL.

## Import Workforce Excel Files

HR uploads exactly two Excel files in one request using the `files` field:

```bash
curl -X POST http://localhost:3003/workforce/import \
  -F 'files=@BCC_Aug.2026.xlsx' \
  -F 'files=@leavedetailsreportbydate_20260911.xlsx'
```

Expected file conventions:

- `BCC_<Mon>.<Year>.xlsx`: employee check-in/checkout details, monthly
- `leavedetailsreportbydate_<timestamp>.xlsx`: employee leave details, monthly

Files are saved under `WORKFORCE_UPLOAD_DIR/<batch-id>/`, which defaults to `./uploads/workforce/<batch-id>/`. The API also reports workbook sheet row counts. Processing and database persistence can be added behind `WorkforceService` later.

## Production

```bash
npm run build
npm run start:prod
```

Logs are written to `LOGGER_FILE_DIRNAME` when `file` is included in `LOGGER_TRANSPORTS`. Files rotate daily and also respect `LOGGER_FILE_MAX_SIZE`.
