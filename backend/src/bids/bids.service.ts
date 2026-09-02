import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IsInt, IsString } from 'class-validator';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WindowService } from '../window/window.service';

export class PlaceBidDto {
  @IsString()
  classId!: string;

  @IsInt({ message: 'Bid amount must be a whole number of points.' })
  amount!: number;
}

export interface BidRow {
  id: string;
  classId: string;
  className: string;
  classCode: string;
  amount: number;
  status: 'active' | 'won' | 'lost' | 'cancelled';
  updatedAt: string;
}

const WINDOW_CLOSED =
  'The bidding window is not open, so bids cannot be placed, edited, or cancelled.';

@Injectable()
export class BidsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly window: WindowService,
  ) {}

  /**
   * Place or edit the caller's bid on a class.
   *
   * Checks run in the order the specification fixes: unknown class 404, closed
   * window 422, non-positive amount 422, over-balance 422. The student row is
   * locked FOR UPDATE so two concurrent bids cannot both pass the balance check.
   */
  async place(user: User, dto: PlaceBidDto): Promise<{ bid: BidRow; balance: BalanceView }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;

      const klass = await tx.class.findUnique({ where: { id: dto.classId } });
      if (!klass) {
        throw new NotFoundException('That class does not exist.');
      }

      const window = await tx.biddingWindow.findUnique({ where: { id: 1 } });
      const open =
        !!window && WindowService.stateOf(window.opensAt, window.closesAt) === 'open';
      if (!open) {
        throw new UnprocessableEntityException(WINDOW_CLOSED);
      }

      const amount = Number(dto.amount);
      if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
        throw new UnprocessableEntityException('Bid amount must be greater than 0.');
      }

      const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      const others = await tx.bid.findMany({
        where: { userId: user.id, status: 'ACTIVE', classId: { not: klass.id } },
        select: { amount: true },
      });
      const committedElsewhere = others.reduce((sum, bid) => sum + bid.amount, 0);
      const headroom = fresh.pointBalance - committedElsewhere;
      if (amount > headroom) {
        throw new UnprocessableEntityException(
          `Bid exceeds your available balance. You have ${Math.max(0, headroom)} points left to commit.`,
        );
      }

      const existing = await tx.bid.findFirst({
        where: { userId: user.id, classId: klass.id, status: 'ACTIVE' },
      });
      const bid = existing
        ? await tx.bid.update({ where: { id: existing.id }, data: { amount } })
        : await tx.bid.create({
            data: { userId: user.id, classId: klass.id, amount, status: 'ACTIVE' },
          });

      const committed = committedElsewhere + amount;
      return {
        bid: {
          id: bid.id,
          classId: klass.id,
          className: klass.name,
          classCode: klass.code,
          amount: bid.amount,
          status: 'active',
          updatedAt: bid.updatedAt.toISOString(),
        },
        balance: {
          pointBalance: fresh.pointBalance,
          committed,
          available: fresh.pointBalance - committed,
        },
      };
    });
  }

  /** Cancelling keeps the row for audit but frees the points immediately. */
  async cancel(user: User, id: string): Promise<{ balance: BalanceView }> {
    const bid = await this.prisma.bid.findUnique({ where: { id } });
    if (!bid) {
      throw new NotFoundException('That bid does not exist.');
    }
    if (bid.userId !== user.id) {
      throw new ForbiddenException('You can only cancel your own bids.');
    }
    if (!(await this.window.isOpen())) {
      throw new UnprocessableEntityException(WINDOW_CLOSED);
    }
    if (bid.status !== 'ACTIVE') {
      throw new UnprocessableEntityException('Only an active bid can be cancelled.');
    }
    await this.prisma.bid.update({ where: { id }, data: { status: 'CANCELLED' } });
    return { balance: await this.balance(user) };
  }

  async myBids(user: User): Promise<{ bids: BidRow[]; balance: BalanceView }> {
    const bids = await this.prisma.bid.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      include: { class: true },
    });
    return {
      bids: bids.map((bid) => ({
        id: bid.id,
        classId: bid.classId,
        className: bid.class.name,
        classCode: bid.class.code,
        amount: bid.amount,
        status: 'active',
        updatedAt: bid.updatedAt.toISOString(),
      })),
      balance: await this.balance(user),
    };
  }

  /** `available` is the committed balance minus everything currently reserved. */
  async balance(user: User): Promise<BalanceView> {
    const fresh = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const active = await this.prisma.bid.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      select: { amount: true },
    });
    const committed = active.reduce((sum, bid) => sum + bid.amount, 0);
    return {
      pointBalance: fresh.pointBalance,
      committed,
      available: fresh.pointBalance - committed,
    };
  }
}

export interface BalanceView {
  pointBalance: number;
  committed: number;
  available: number;
}
