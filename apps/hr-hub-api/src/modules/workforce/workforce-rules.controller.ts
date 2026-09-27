import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CreateWorkforceRuleInput, UpdateWorkforceRuleInput, WorkforceRulesService } from './workforce-rules.service';

@Controller('api/workforce/rules')
export class WorkforceRulesController {
  constructor(private readonly workforceRulesService: WorkforceRulesService) {}

  /**
   * Get DB rules.
   *
   * GET /workforce/rules
   * GET /workforce/rules?includeDisabled=true
   */
  @Get()
  findAll(@Query('includeDisabled') includeDisabled?: string) {
    return this.workforceRulesService.findAll({
      includeDisabled: includeDisabled === 'true',
    });
  }

  /**
   * Get one rule.
   *
   * GET /workforce/rules/:id
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workforceRulesService.findOne(id);
  }

  /**
   * Create a rule.
   *
   * POST /workforce/rules
   */
  @Post()
  create(@Body() input: CreateWorkforceRuleInput) {
    return this.workforceRulesService.create(input);
  }

  /**
   * Update a rule.
   *
   * PATCH /workforce/rules/:id
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateWorkforceRuleInput) {
    return this.workforceRulesService.update(id, input);
  }

  /**
   * Enable/disable a rule.
   *
   * PATCH /workforce/rules/:id/enabled
   */
  @Patch(':id/enabled')
  setEnabled(@Param('id') id: string, @Body() body: { enabled: boolean }) {
    return this.workforceRulesService.setEnabled(id, body.enabled);
  }

  /**
   * Delete a rule.
   *
   * DELETE /workforce/rules/:id
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workforceRulesService.remove(id);
  }

  /**
   * Manually reload the in-memory cache.
   *
   * POST /workforce/rules/reload
   */
  @Post('reload')
  async reload() {
    await this.workforceRulesService.reload();

    return {
      success: true,
    };
  }

  /**
   * Get the current effective configuration sources.
   *
   * GET /workforce/rules/configuration
   */
  @Get('meta/configuration')
  getConfiguration() {
    return this.workforceRulesService.getConfiguration();
  }
}
