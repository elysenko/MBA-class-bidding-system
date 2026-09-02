import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ResultRow {
  id: string;
  classId: string;
  className: string;
  classCode: string;
  amount: number;
  outcome: 'won' | 'lost';
  /** Lowest winning bid for that class — 0 when nobody won a seat. */
  clearingPrice: number;
}

export interface ClassResultRow {
  id: string;
  studentName: string;
  studentEmail: string;
  amount: number;
  outcome: 'won' | 'lost' | 'active';
  rank: number;
}

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Per-class outcome for one student. Empty until the round has resolved. */
  async forStudent(studentId: string): Promise<ResultRow[]> {
    const bids = await this.prisma.bid.findMany({
      where: { userId: studentId, status: { in: ['WON', 'LOST'] } },
      orderBy: [{ updatedAt: 'desc' }, { amount: 'desc' }],
      include: { class: true },
    });
    if (bids.length === 0) {
      return [];
    }
    const clearing = await this.clearingPrices(bids.map((bid) => bid.classId));
    return bids.map((bid) => ({
      id: bid.id,
      classId: bid.classId,
      className: bid.class.name,
      classCode: bid.class.code,
      amount: bid.amount,
      outcome: bid.status === 'WON' ? 'won' : 'lost',
      clearingPrice: clearing.get(bid.classId) ?? 0,
    }));
  }

  /** A student may read only their own results; administrators may read anyone's. */
  async forStudentAs(caller: User, studentId: string): Promise<ResultRow[]> {
    if (caller.role !== 'ADMIN' && caller.id !== studentId) {
      throw new ForbiddenException("You cannot view another student's results.");
    }
    if (caller.role === 'ADMIN') {
      const exists = await this.prisma.user.findFirst({
        where: { id: studentId, role: 'USER' },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundException('That student does not exist.');
      }
    }
    return this.forStudent(studentId);
  }

  /** Every bid on one class, winners first then highest-first. */
  async forClass(classId: string): Promise<{
    summary: Record<string, unknown>;
    rows: ClassResultRow[];
  }> {
    const klass = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        bids: {
          where: { status: { not: 'CANCELLED' } },
          include: { user: true },
        },
      },
    });
    if (!klass) {
      throw new NotFoundException('That class does not exist.');
    }
    const window = await this.prisma.biddingWindow.findUnique({ where: { id: 1 } });

    const ordered = [...klass.bids].sort((a, b) => {
      const rank = (status: string): number => (status === 'WON' ? 0 : 1);
      return rank(a.status) - rank(b.status) || b.amount - a.amount;
    });

    return {
      summary: {
        id: klass.id,
        name: klass.name,
        code: klass.code,
        seatCap: klass.seatCap,
        resolvedAt: window?.resolvedAt ? window.resolvedAt.toISOString() : null,
      },
      rows: ordered.map((bid, index) => ({
        id: bid.id,
        studentName: bid.user.name ?? bid.user.email,
        studentEmail: bid.user.email,
        amount: bid.amount,
        outcome:
          bid.status === 'WON' ? 'won' : bid.status === 'LOST' ? 'lost' : 'active',
        rank: index + 1,
      })),
    };
  }

  private async clearingPrices(classIds: string[]): Promise<Map<string, number>> {
    const grouped = await this.prisma.bid.groupBy({
      by: ['classId'],
      where: { classId: { in: classIds }, status: 'WON' },
      _min: { amount: true },
    });
    return new Map(grouped.map((row) => [row.classId, row._min.amount ?? 0]));
  }
}
