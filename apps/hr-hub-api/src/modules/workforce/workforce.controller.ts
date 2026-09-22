import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
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
import { Body } from '@nestjs/common';
import { StageOneWorkforceService } from './stage-one-workforce.service';
import { ConfirmWorkforceImportDto } from './dto/confirm-workforce-import.dto';

@Controller('workforce')
export class WorkforceController {
  constructor(
    private readonly workforceService: WorkforceService,
    private readonly imports: StageOneWorkforceService,
  ) {}

  @Post('import/preview')
  @UseGuards(AuthGuard)
  @UseInterceptors(FilesInterceptor('files', 2, { limits: { fileSize: 10 * 1024 * 1024 } }))
  // @ts-ignore
  previewImport(@UploadedFiles() files: Express.Multer.File[], @CurrentUser() user: AuthenticatedUser) {
    return this.imports.preview(files, user);
  }

  @Post('import/:batchId/confirm')
  @UseGuards(AuthGuard)
  confirmImport(@Param('batchId') batchId: string, @Body() dto: ConfirmWorkforceImportDto) {
    return this.imports.confirm(batchId, dto);
  }

  @Get('imports')
  @UseGuards(AuthGuard)
  listImports() {
    return this.imports.list();
  }

  @Get('imports/:batchId')
  @UseGuards(AuthGuard)
  getImport(@Param('batchId') batchId: string) {
    return this.imports.get(batchId);
  }

  @Post('import')
  @UseGuards(AuthGuard)
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

  @Get('metadata')
  getMetadata(@Query() query: any) {
    return {};
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
