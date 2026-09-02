import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { ClassResultRow, ResultRow, ResultsService } from './results.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminGuard, SessionGuard } from '../auth/guards';

@ApiTags('results')
@Controller()
@UseGuards(SessionGuard)
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get('me/results')
  mine(@CurrentUser() user: User): Promise<ResultRow[]> {
    return this.results.forStudent(user.id);
  }

  @Get('students/:id/results')
  forStudent(@CurrentUser() user: User, @Param('id') id: string): Promise<ResultRow[]> {
    return this.results.forStudentAs(user, id);
  }

  @Get('admin/classes/:id/results')
  @UseGuards(AdminGuard)
  forClass(
    @Param('id') id: string,
  ): Promise<{ summary: Record<string, unknown>; rows: ClassResultRow[] }> {
    return this.results.forClass(id);
  }
}
