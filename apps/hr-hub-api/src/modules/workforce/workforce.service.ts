import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as XLSX from 'xlsx';
import { LateFineCalculatorService } from './late-fine-calculator.service';
import { LateFineReport } from './models/late-fine-report.model';
import { MonthlyReportsRepository } from './monthly-reports.repository';
import { PrismaService } from '@app/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { WorkforceRules } from './models/workforce-rules.model';
import { WorkforceRulesService } from './workforce-rules.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { TraceContextService } from '../app/trace/trace-context.service';
import dayjs from 'dayjs';

type WorkforceFileKind = 'CHECKIN_CHECKOUT' | 'LEAVE';

interface SourceFile {
  originalname: string;
  buffer: Buffer;
}

export interface WorkforceFileSummary {
  fileName: string;
  kind: WorkforceFileKind;
  savedPath: string;
  sheets: Array<{
    name: string;
    rowCount: number;
  }>;
}

export interface WorkforceImportResult {
  batchId: string;
  savedTo: string;
  imported: WorkforceFileSummary[];
  lateFineReport: LateFineReport;
  month: string | null;
  message: string;
}

interface ParsedWorkforceFile {
  file: SourceFile;
  kind: WorkforceFileKind;
  workbook: XLSX.WorkBook;
  summary: WorkforceFileSummary;
}

export interface WorkforceMetadata {
  rules?: WorkforceRules;
}

export type WorkforceMetadataQuery = Partial<Record<keyof WorkforceMetadata, boolean>>;

@Injectable()
export class WorkforceService {
  private logger: TraceLogger;

  constructor(
    private readonly config: ConfigService,
    private readonly lateFineCalculator: LateFineCalculatorService,
    private readonly workforceRules: WorkforceRulesService,
    private readonly monthlyReports: MonthlyReportsRepository,
    private readonly prisma: PrismaService,
    readonly traceContext: TraceContextService,
  ) {
    this.logger = new TraceLogger(traceContext, WorkforceService.name);
  }

  // @ts-ignore
  // async importExcelFiles(files: Express.Multer.File[]): Promise<WorkforceImportResult> {
  //   const parsed = files.map((file) => this.readWorkbook(file));
  //   const kinds = new Set(parsed.map((item) => item.kind));

  //   if (kinds.size !== 2) {
  //     throw new BadRequestException('The request must contain one check-in/checkout file and one leave file');
  //   }

  //   const batchId = `${this.batchTimestamp()}-${randomUUID().slice(0, 8)}`;
  //   const batchDirectory = join(this.uploadRoot(), batchId);
  //   await mkdir(batchDirectory, { recursive: true });

  //   for (const item of parsed) {
  //     const savedPath = join(batchDirectory, basename(item.file.originalname));
  //     await writeFile(savedPath, item.file.buffer);
  //     item.summary.savedPath = savedPath;
  //   }

  //   const lateFineReport = this.calculateReport(parsed);
  //   const derived = deriveMonthAndLabel(lateFineReport);
  //   if (derived) {
  //     await this.monthlyReports.save(derived.month, derived.label, batchId, lateFineReport);
  //   }

  //   return {
  //     batchId,
  //     savedTo: batchDirectory,
  //     imported: parsed.map((item) => item.summary),
  //     lateFineReport,
  //     month: derived?.month ?? null,
  //     message: 'Check-in/checkout and leave Excel files saved and analyzed successfully.',
  //   };
  // }

  async listMonthlyReports(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ month: string }>>(
      Prisma.sql`
        SELECT DISTINCT strftime('%Y-%m', date) AS month
        FROM Attendance
        WHERE date IS NOT NULL
        ORDER BY month DESC
      `,
    );

    return rows.map((row) => row.month);
  }

  async getMonthlyReport(month: string): Promise<any> {
    const monthStart = dayjs(`${month}-01`).startOf('month').format('YYYY-MM-DD');
    const nextMonthStart = dayjs(monthStart).add(1, 'month').startOf('month').format('YYYY-MM-DD');

    this.logger.debug('[getMonthlyReport] ' + JSON.stringify({ monthStart, nextMonthStart, month }));

    const rows = await this.prisma.$queryRaw<
      Array<{
        attendanceId: string;
        employeeCode: string;
        employeeName: string | null;
        date: Date;
        checkIn: Date | null;
        checkOut: Date | null;
        note: string | null;

        fineId: string | null;
        originalFineAmount: number | null;
        adjustedAmount: number | null;
        fineAmount: number;

        monthFinePaidAmount: number;
        monthFinePaidStatus: string;

        feedback: string;
      }>
    >(Prisma.sql`
      SELECT
          a.id AS attendanceId,
          a.employeeCode,
          a.employeeName,
          a.date,
          strftime('%H:%M', a.checkIn) AS checkIn,
          strftime('%H:%M', a.checkOut) AS checkOut,
          a.note,

          f.id AS fineId,
          f.amount AS originalFineAmount,
          f.adjustedAmount,

          CASE
              WHEN f.status = 'cancelled' THEN 0
              ELSE COALESCE(f.adjustedAmount, f.amount, 0)
          END AS fineAmount,

          emf.status as monthFinePaidStatus,
          CASE
              WHEN emf.status = 'completed' THEN emf.payableAmount
              ELSE 0
          END AS monthFinePaidAmount,

          COALESCE(
              (
                  SELECT json_group_array(
                      json_object(
                          'id', ff.id,
                          'reason', ff.reason,
                          'description', ff.description,
                          'status', ff.status,
                          'reductionAmount', ff.reductionAmount,
                          'reviewedBy', ff.reviewedBy,
                          'reviewedByName', ff.reviewedByName,
                          'reviewedAt', ff.reviewedAt,
                          'reviewNote', ff.reviewNote,
                          'createdAt', ff.createdAt
                      )
                  )
                  FROM FineFeedback ff
                  WHERE ff.fineId = f.id
              ),
              '[]'
          ) AS feedback

      FROM Attendance a

      LEFT JOIN Fine f
          ON f.employeeCode = a.employeeCode
          AND date(f.date) = date(a.date)

      LEFT JOIN EmployeeMonthlyFine emf
        ON emf.employeeCode = a.employeeCode
        AND date(emf.month) = date(${monthStart})

      WHERE
          a.date >= ${monthStart}
          AND a.date < ${nextMonthStart}

      ORDER BY
          a.date,
          a.employeeCode
    `);

    const employeeSummaries = new Map<
      string,
      {
        employeeCode: string;
        employeeName: string | null;
        totalFine: number;
        attendanceCount: number;
        monthFinePaidStatus: string;
      }
    >();

    for (const row of rows) {
      let employee = employeeSummaries.get(row.employeeCode);

      if (!employee) {
        employee = {
          employeeCode: row.employeeCode,
          employeeName: row.employeeName,
          totalFine: 0,
          attendanceCount: 0,
          monthFinePaidStatus: row.monthFinePaidStatus,
        };

        employeeSummaries.set(row.employeeCode, employee);
      }

      employee.attendanceCount++;
      const employeeRules = this.workforceRules.resolve(row.employeeCode, row.date);
      employee.totalFine = Math.min(employee.totalFine + Number(row.fineAmount ?? 0), employeeRules.maxFinePerMonth);
    }

    return {
      month,
      employeeSummaries: Array.from(employeeSummaries.values()),
      grandTotal: Array.from(employeeSummaries.values()).reduce((sum, employee) => sum + employee.totalFine, 0),
      rows: rows.map((row) => ({
        ...row,
        feedback: typeof row.feedback === 'string' ? JSON.parse(row.feedback) : row.feedback,
      })),
    };
  }

  // async exportMonthlyReport(month: string): Promise<{ buffer: Buffer; fileName: string }> {
  //   const report = await this.getMonthlyReport(month);
  //   const buffer = await buildLateFineReportWorkbook(report);
  //   return { buffer, fileName: `BCC_ditre_${month}.xlsx` };
  // }

  // /** Re-reads a previously imported batch from disk and exports its late-fine report as an .xlsx file. */
  // async exportBatch(batchId: string): Promise<{ buffer: Buffer; fileName: string }> {
  //   if (!/^[A-Za-z0-9-]+$/.test(batchId)) {
  //     throw new BadRequestException('Invalid batchId');
  //   }
  //   const batchDirectory = join(this.uploadRoot(), batchId);

  //   let fileNames: string[];
  //   try {
  //     fileNames = await readdir(batchDirectory);
  //   } catch {
  //     throw new NotFoundException(`No uploaded batch found for batchId "${batchId}"`);
  //   }

  //   const parsed = await Promise.all(
  //     fileNames.map(async (name) => {
  //       const buffer = await readFile(join(batchDirectory, name));
  //       return this.readWorkbook({ originalname: name, buffer });
  //     }),
  //   );

  //   const lateFineReport = this.calculateReport(parsed);
  //   const buffer = await buildLateFineReportWorkbook(lateFineReport);

  //   return { buffer, fileName: `BCC_ditre_${batchId}.xlsx` };
  // }

  // private calculateReport(parsed: ParsedWorkforceFile[]): LateFineReport {
  //   const attendanceFile = parsed.find((item) => item.kind === 'CHECKIN_CHECKOUT');
  //   const leaveFile = parsed.find((item) => item.kind === 'LEAVE');
  //   if (!attendanceFile || !leaveFile) {
  //     throw new BadRequestException('The batch must contain one check-in/checkout file and one leave file');
  //   }

  //   const attendanceRecords = parseAttendanceWorkbook(attendanceFile.workbook, this.lateFineCalculator.rules);
  //   const leaveCoverage = parseLeaveWorkbook(leaveFile.workbook, this.lateFineCalculator.rules);
  //   return this.lateFineCalculator.calculate(attendanceRecords, leaveCoverage);
  // }

  private readWorkbook(file: SourceFile): ParsedWorkforceFile {
    const kind = this.classifyFile(file.originalname);
    if (!kind) {
      throw new BadRequestException(
        `Invalid workforce file name: ${file.originalname}. Expected BCC_<Mon>.<Year>.xlsx or leavedetailsreportbydate_<timestamp>.xlsx`,
      );
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
    } catch {
      throw new BadRequestException(`Unable to read Excel file: ${file.originalname}`);
    }

    return {
      file,
      kind,
      workbook,
      summary: {
        fileName: file.originalname,
        kind,
        savedPath: '',
        sheets: workbook.SheetNames.map((name) => ({
          name,
          rowCount: Math.max(XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 }).length - 1, 0),
        })),
      },
    };
  }

  private classifyFile(fileName: string): WorkforceFileKind | undefined {
    if (/^BCC_[A-Za-z]{3}\.\d{4}\.xlsx$/i.test(fileName)) return 'CHECKIN_CHECKOUT';
    if (/^leavedetailsreportbydate_.+\.xlsx$/i.test(fileName)) return 'LEAVE';
    return undefined;
  }

  private uploadRoot(): string {
    return this.config.get<string>('WORKFORCE_UPLOAD_DIR', './uploads/workforce');
  }

  private batchTimestamp(): string {
    return new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '-')
      .replace(/\.\d{3}Z$/, '');
  }
}

/** Derives the ISO yyyy-MM month key and a Vietnamese sheet-style label (e.g. "Báo cáo đi trễ T8.2026") from a report's first row. */
function deriveMonthAndLabel(report: LateFineReport): { month: string; label: string } | null {
  const firstRow = report.rows[0];
  if (!firstRow) return null;

  const month = firstRow.date.slice(0, 7);
  const [year, monthNum] = month.split('-');
  return { month, label: `Báo cáo đi trễ T${Number(monthNum)}.${year}` };
}
