import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AccountsService, StudentRow } from './accounts.service';
import { CreateAdminDto, CreateStudentDto } from '../auth/auth.dto';
import { AdminGuard, RootAdminGuard, SessionGuard } from '../auth/guards';

@ApiTags('accounts')
@Controller('admin/accounts')
@UseGuards(SessionGuard, AdminGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get('admins')
  listAdmins(): Promise<Array<Record<string, unknown>>> {
    return this.accounts.listAdmins();
  }

  @Get('students')
  listStudents(): Promise<StudentRow[]> {
    return this.accounts.listStudents();
  }

  @Post('admins')
  @UseGuards(RootAdminGuard)
  async createAdmin(@Body() dto: CreateAdminDto): Promise<Record<string, unknown>> {
    return { admin: await this.accounts.createAdmin(dto) };
  }

  @Post('students')
  @UseGuards(RootAdminGuard)
  async createStudent(@Body() dto: CreateStudentDto): Promise<unknown> {
    const { student, delivered } = await this.accounts.createStudent(dto);
    return { student, email_delivered: delivered, emailDelivered: delivered };
  }

  @Post('students/:id/resend-token')
  @HttpCode(200)
  @UseGuards(RootAdminGuard)
  async resend(@Param('id') id: string): Promise<unknown> {
    const { student, delivered } = await this.accounts.resendToken(id);
    return { student, email_delivered: delivered, emailDelivered: delivered };
  }
}
