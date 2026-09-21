import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  Post,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { WorkforceService } from './workforce.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('workforce')
@UseGuards(AuthGuard)
export class WorkforceController {
  constructor(private readonly workforceService: WorkforceService) {}

  @Post('import')
  @UseInterceptors(
    FilesInterceptor('files', 2, {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  // @ts-ignore
  importExcelFiles(@UploadedFiles() files: Express.Multer.File[], @CurrentUser() user: AuthenticatedUser) {
    if (!files || files.length !== 2) {
      throw new BadRequestException('Exactly two Excel files are required: one check-in/checkout file and one leave file');
    }

    return this.workforceService.importExcelFiles(files);
  }

  @Get('reports')
  listReports() {
    return this.workforceService.listMonthlyReports();
  }

  @Get('reports/:month')
  getReport(@Param('month') month: string) {
    return this.workforceService.getMonthlyReport(month);
  }

  @Get('reports/:month/export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportReport(@Param('month') month: string): Promise<StreamableFile> {
    const { buffer, fileName } = await this.workforceService.exportMonthlyReport(month);
    return new StreamableFile(buffer, { disposition: `attachment; filename="${fileName}"` });
  }

  @Get('export/:batchId')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportBatch(@Param('batchId') batchId: string): Promise<StreamableFile> {
    const { buffer, fileName } = await this.workforceService.exportBatch(batchId);
    return new StreamableFile(buffer, { disposition: `attachment; filename="${fileName}"` });
  }
}
