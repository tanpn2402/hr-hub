import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '@app/prisma/prisma.service';

export interface CreateEmployeeDto {
  employeeCode: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  joinedAt?: string;
  active?: boolean;
}

export interface UpdateEmployeeDto {
  employeeCode?: string;
  name?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  joinedAt?: string;
  active?: boolean;
}

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.employee.findMany({
      orderBy: {
        employeeCode: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  async findByCode(employeeCode: string) {
    return this.prisma.employee.findUnique({
      where: { employeeCode },
    });
  }

  async create(dto: CreateEmployeeDto) {
    const existing = await this.findByCode(dto.employeeCode);

    if (existing) {
      throw new ConflictException(`Employee ${dto.employeeCode} already exists`);
    }

    return this.prisma.employee.create({
      data: {
        employeeCode: dto.employeeCode,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        department: dto.department,
        position: dto.position,
        joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : undefined,
        active: dto.active ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.findOne(id);

    if (dto.employeeCode) {
      const existing = await this.findByCode(dto.employeeCode);

      if (existing && existing.id !== id) {
        throw new ConflictException(`Employee ${dto.employeeCode} already exists`);
      }
    }

    return this.prisma.employee.update({
      where: { id },
      data: {
        employeeCode: dto.employeeCode,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        department: dto.department,
        position: dto.position,
        joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : undefined,
        active: dto.active,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.employee.delete({
      where: { id },
    });
  }
}
