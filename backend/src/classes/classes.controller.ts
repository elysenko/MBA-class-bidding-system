import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { ClassesService, ClassRow } from './classes.service';
import { CreateClassDto, UpdateClassDto } from './classes.dto';
import { AdminGuard, SessionGuard } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('classes')
@Controller()
@UseGuards(SessionGuard)
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get('classes')
  list(@CurrentUser() user: User): Promise<ClassRow[]> {
    return this.classes.list(user);
  }

  @Get('classes/:id')
  findOne(@CurrentUser() user: User, @Param('id') id: string): Promise<ClassRow> {
    return this.classes.findOne(user, id);
  }

  @Post('admin/classes')
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateClassDto): Promise<Record<string, unknown>> {
    return this.classes.create(dto);
  }

  @Patch('admin/classes/:id')
  @UseGuards(AdminGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
  ): Promise<Record<string, unknown>> {
    return this.classes.update(id, dto);
  }
}
