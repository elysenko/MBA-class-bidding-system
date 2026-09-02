import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SaveWindowDto, WindowService, WindowView } from './window.service';
import { AdminGuard, SessionGuard } from '../auth/guards';

@ApiTags('window')
@Controller()
@UseGuards(SessionGuard)
export class WindowController {
  constructor(private readonly window: WindowService) {}

  @Get('window')
  get(): Promise<WindowView> {
    return this.window.get();
  }

  @Put('admin/window')
  @UseGuards(AdminGuard)
  save(@Body() dto: SaveWindowDto): Promise<WindowView> {
    return this.window.save(dto);
  }
}
