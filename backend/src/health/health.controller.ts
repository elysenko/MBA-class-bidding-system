import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness — never touches the database, so it stays green during a DB blip. */
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }

  /** Readiness — proves the database is actually reachable. */
  @Get('deep')
  async deep(@Res({ passthrough: true }) res: Response): Promise<Record<string, unknown>> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok' };
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'error', database: 'unreachable', detail: String(error) };
    }
  }
}
