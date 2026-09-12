import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import * as XLSX from 'xlsx';
import { buildLateFineReportWorkbook } from './exporters/late-fine-report.exporter';
import { LateFineCalculatorService } from './late-fine-calculator.service';
import { LateFineReport } from './models/late-fine-report.model';
import { parseAttendanceWorkbook } from './parsers/attendance-workbook.parser';
import { parseLeaveWorkbook } from './parsers/leave-workbook.parser';

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
  message: string;
}

interface ParsedWorkforceFile {
  file: SourceFile;
  kind: WorkforceFileKind;
  workbook: XLSX.WorkBook;
  summary: WorkforceFileSummary;
}

@Injectable()
export class WorkforceService {
  constructor(
    private readonly config: ConfigService,
    private readonly lateFineCalculator: LateFineCalculatorService,
  ) {}

  async importExcelFiles(files: Express.Multer.File[]): Promise<WorkforceImportResult> {
    const parsed = files.map((file) => this.readWorkbook(file));
    const kinds = new Set(parsed.map((item) => item.kind));

    if (kinds.size !== 2) {
      throw new BadRequestException('The request must contain one check-in/checkout file and one leave file');
    }

    const batchId = `${this.batchTimestamp()}-${randomUUID().slice(0, 8)}`;
    const batchDirectory = join(this.uploadRoot(), batchId);
    await mkdir(batchDirectory, { recursive: true });

    for (const item of parsed) {
      const savedPath = join(batchDirectory, basename(item.file.originalname));
      await writeFile(savedPath, item.file.buffer);
      item.summary.savedPath = savedPath;
    }

    const lateFineReport = this.calculateReport(parsed);

    return {
      batchId,
      savedTo: batchDirectory,
      imported: parsed.map((item) => item.summary),
      lateFineReport,
      message: 'Check-in/checkout and leave Excel files saved and analyzed successfully.',
    };
  }

  /** Re-reads a previously imported batch from disk and exports its late-fine report as an .xlsx file. */
  async exportBatch(batchId: string): Promise<{ buffer: Buffer; fileName: string }> {
    if (!/^[A-Za-z0-9-]+$/.test(batchId)) {
      throw new BadRequestException('Invalid batchId');
    }
    const batchDirectory = join(this.uploadRoot(), batchId);

    let fileNames: string[];
    try {
      fileNames = await readdir(batchDirectory);
    } catch {
      throw new NotFoundException(`No uploaded batch found for batchId "${batchId}"`);
    }

    const parsed = await Promise.all(
      fileNames.map(async (name) => {
        const buffer = await readFile(join(batchDirectory, name));
        return this.readWorkbook({ originalname: name, buffer });
      }),
    );

    const lateFineReport = this.calculateReport(parsed);
    const buffer = await buildLateFineReportWorkbook(lateFineReport);

    return { buffer, fileName: `BCC_ditre_${batchId}.xlsx` };
  }

  private calculateReport(parsed: ParsedWorkforceFile[]): LateFineReport {
    const attendanceFile = parsed.find((item) => item.kind === 'CHECKIN_CHECKOUT');
    const leaveFile = parsed.find((item) => item.kind === 'LEAVE');
    if (!attendanceFile || !leaveFile) {
      throw new BadRequestException('The batch must contain one check-in/checkout file and one leave file');
    }

    const attendanceRecords = parseAttendanceWorkbook(attendanceFile.workbook, this.lateFineCalculator.rules);
    const leaveCoverage = parseLeaveWorkbook(leaveFile.workbook, this.lateFineCalculator.rules);
    return this.lateFineCalculator.calculate(attendanceRecords, leaveCoverage);
  }

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
