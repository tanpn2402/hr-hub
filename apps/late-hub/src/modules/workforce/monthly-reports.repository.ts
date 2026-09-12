import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LateFineReport } from './models/late-fine-report.model';
import { MonthlyReport, MonthlyReportSummary } from './models/monthly-report.model';

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

/** Persists one late-fine report per calendar month as a JSON file - re-importing the same month overwrites it. */
@Injectable()
export class MonthlyReportsRepository {
  constructor(private readonly config: ConfigService) {}

  async save(month: string, label: string, batchId: string, report: LateFineReport): Promise<MonthlyReport> {
    const stored: MonthlyReport = {
      month,
      label,
      batchId,
      updatedAt: new Date().toISOString(),
      grandTotal: report.grandTotal,
      rows: report.rows,
      employeeSummaries: report.employeeSummaries,
    };
    await mkdir(this.reportsDir(), { recursive: true });
    await writeFile(this.reportPath(month), JSON.stringify(stored, null, 2));
    return stored;
  }

  async list(): Promise<MonthlyReportSummary[]> {
    let fileNames: string[];
    try {
      fileNames = await readdir(this.reportsDir());
    } catch {
      return [];
    }

    const summaries = await Promise.all(
      fileNames
        .filter((name) => name.endsWith('.json'))
        .map(async (name) => {
          const stored = JSON.parse(await readFile(join(this.reportsDir(), name), 'utf-8')) as MonthlyReport;
          const { rows: _rows, employeeSummaries: _employeeSummaries, ...summary } = stored;
          return summary;
        }),
    );

    return summaries.sort((a, b) => b.month.localeCompare(a.month));
  }

  async get(month: string): Promise<MonthlyReport | null> {
    try {
      const content = await readFile(this.reportPath(month), 'utf-8');
      return JSON.parse(content) as MonthlyReport;
    } catch {
      return null;
    }
  }

  private reportsDir(): string {
    return join(this.config.get<string>('WORKFORCE_UPLOAD_DIR', './uploads/workforce'), 'reports');
  }

  private reportPath(month: string): string {
    if (!MONTH_PATTERN.test(month)) {
      throw new BadRequestException(`Invalid month "${month}", expected format YYYY-MM`);
    }
    return join(this.reportsDir(), `${month}.json`);
  }
}
