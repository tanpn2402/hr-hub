import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { HrRolesGuard } from '../auth/hr-roles.guard';
import { CreateEmployeeDto, EmployeesService, UpdateEmployeeDto } from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll() {
    return this.employeesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Get('code/:employeeCode')
  findByCode(@Param('employeeCode') employeeCode: string) {
    return this.employeesService.findByCode(employeeCode);
  }

  @Post()
  @UseGuards(AuthGuard, HrRolesGuard)
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, HrRolesGuard)
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, HrRolesGuard)
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }
}
