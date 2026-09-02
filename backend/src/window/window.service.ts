import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { IsDateString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

export type WindowState = 'pending' | 'open' | 'closed';

export class SaveWindowDto {
  @IsDateString({}, { message: 'Provide a valid open time.' })
  opensAt!: string;

  @IsDateString({}, { message: 'Provide a valid close time.' })
  closesAt!: string;
}

export interface WindowView {
  opensAt: string | null;
  closesAt: string | null;
  resolvedAt: string | null;
  state: WindowState;
}

@Injectable()
export class WindowService {
  constructor(private readonly prisma: PrismaService) {}

  static stateOf(opensAt: Date, closesAt: Date, now = new Date()): WindowState {
    if (now < opensAt) return 'pending';
    if (now < closesAt) return 'open';
    return 'closed';
  }

  async get(): Promise<WindowView> {
    const row = await this.prisma.biddingWindow.findUnique({ where: { id: 1 } });
    if (!row) {
      return { opensAt: null, closesAt: null, resolvedAt: null, state: 'pending' };
    }
    return {
      opensAt: row.opensAt.toISOString(),
      closesAt: row.closesAt.toISOString(),
      resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
      state: WindowService.stateOf(row.opensAt, row.closesAt),
    };
  }

  /** True only while bids may be created, edited, or cancelled. */
  async isOpen(): Promise<boolean> {
    const row = await this.prisma.biddingWindow.findUnique({ where: { id: 1 } });
    if (!row) return false;
    return WindowService.stateOf(row.opensAt, row.closesAt) === 'open';
  }

  /**
   * Saving a window whose close time is still in the future clears `resolvedAt`,
   * which is what starts a fresh round.
   */
  async save(dto: SaveWindowDto): Promise<WindowView> {
    const opensAt = new Date(dto.opensAt);
    const closesAt = new Date(dto.closesAt);
    if (Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime())) {
      throw new UnprocessableEntityException('Provide valid open and close times.');
    }
    if (closesAt <= opensAt) {
      throw new UnprocessableEntityException('The close time must be later than the open time.');
    }
    const reopens = closesAt.getTime() > Date.now();
    await this.prisma.biddingWindow.upsert({
      where: { id: 1 },
      update: { opensAt, closesAt, ...(reopens ? { resolvedAt: null } : {}) },
      create: { id: 1, opensAt, closesAt },
    });
    return this.get();
  }
}
