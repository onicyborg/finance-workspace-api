import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  Post,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { WorkspaceMemberGuard } from 'src/workspace/guards/workspace-member.guard';
import { ReportsService } from './reports.service';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { CustomReportDto } from './dto/custom-report.dto';

@Controller('workspaces/:workspaceId/reports')
@ApiBearerAuth('access-token')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Get monthly financial report (JSON)' })
  @Get('monthly')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  getMonthlyReport(
    @Param('workspaceId') workspaceId: string,
    @Query() query: MonthlyReportQueryDto,
  ) {
    return this.reportsService.getMonthlyReport(workspaceId, query);
  }

  @ApiOperation({ summary: 'Export monthly financial report as PDF' })
  @Get('monthly/export-pdf')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  async exportMonthlyReportPdf(
    @Param('workspaceId') workspaceId: string,
    @Query() query: MonthlyReportQueryDto,
    @Res() res: any, // ← pakai any, tidak perlu import express
  ) {
    const pdfBuffer = await this.reportsService.exportMonthlyReportPdf(
      workspaceId,
      query,
    );

    const monthStr = String(query.month).padStart(2, '0');
    const filename = `report-${query.year}-${monthStr}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  // ── CUSTOM ───────────────────────────────────

  @ApiOperation({ summary: 'Get meta options for custom report filter' })
  @Get('meta')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  getReportMeta(@Param('workspaceId') workspaceId: string) {
    return this.reportsService.getReportMeta(workspaceId);
  }

  @ApiOperation({ summary: 'Get custom financial report (JSON)' })
  @Post('custom')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  getCustomReport(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CustomReportDto,
  ) {
    return this.reportsService.getCustomReport(workspaceId, dto);
  }

  @ApiOperation({ summary: 'Export custom financial report as PDF' })
  @Post('custom/export-pdf')
  @UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
  async exportCustomReportPdf(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CustomReportDto,
    @Res() res: any,
  ) {
    const pdfBuffer = await this.reportsService.exportCustomReportPdf(
      workspaceId,
      dto,
    );
    const filename = `custom-report-${dto.from}-to-${dto.to}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
