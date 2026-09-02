import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard, SessionGuard } from '../auth/guards';
import { ResolutionOutcome, ResolutionService } from '../resolution/resolution.service';

@ApiTags('admin')
@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class AdminOpsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolution: ResolutionService,
  ) {}

  /**
   * Destructive: every balance returns to 1000, every active bid is cancelled,
   * and the round reopens. Historical won/lost bids are deliberately retained.
   */
  @Post('points/reset')
  @HttpCode(200)
  async resetPoints(): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.bid.updateMany({
        where: { status: 'ACTIVE' },
        data: { status: 'CANCELLED' },
      });
      const reset = await tx.user.updateMany({
        where: { role: 'USER' },
        data: { pointBalance: 1000 },
      });
      await tx.biddingWindow.updateMany({ where: { id: 1 }, data: { resolvedAt: null } });
      return {
        ok: true,
        bidsCancelled: cancelled.count,
        studentsReset: reset.count,
      };
    });
  }

  /** Manual trigger for the same job the scheduler runs every 10 seconds. */
  @Post('resolve')
  @HttpCode(200)
  resolveNow(): Promise<ResolutionOutcome> {
    return this.resolution.resolveWindow();
  }
}
