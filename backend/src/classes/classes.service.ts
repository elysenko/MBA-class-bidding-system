import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto, UpdateClassDto } from './classes.dto';

export interface ClassRow {
  id: string;
  name: string;
  code: string;
  faculty: string;
  term: string;
  seatCap: number;
  /** Only populated once the round has been resolved. */
  seatsTaken: number | null;
  bidCount: number;
  myBidId: string | null;
  myBidAmount: number | null;
  myBidStatus: 'active' | 'won' | 'lost' | 'cancelled' | null;
}

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Catalogue for any signed-in identity. A student sees aggregate demand and
   * *their own* bid only — never another student's amount.
   */
  async list(user: User): Promise<ClassRow[]> {
    const [classes, window] = await Promise.all([
      this.prisma.class.findMany({
        orderBy: { name: 'asc' },
        include: {
          bids: {
            where: { status: { not: 'CANCELLED' } },
            select: { id: true, userId: true, amount: true, status: true },
          },
        },
      }),
      this.prisma.biddingWindow.findUnique({ where: { id: 1 } }),
    ]);
    const resolved = !!window?.resolvedAt;

    return classes.map((klass) => {
      const mine = klass.bids.find((bid) => bid.userId === user.id) ?? null;
      return {
        id: klass.id,
        name: klass.name,
        code: klass.code,
        faculty: klass.faculty,
        term: klass.term,
        seatCap: klass.seatCap,
        seatsTaken: resolved
          ? klass.bids.filter((bid) => bid.status === 'WON').length
          : null,
        bidCount: klass.bids.length,
        myBidId: mine ? mine.id : null,
        myBidAmount: mine ? mine.amount : null,
        myBidStatus: mine
          ? (mine.status.toLowerCase() as ClassRow['myBidStatus'])
          : null,
      };
    });
  }

  async findOne(user: User, id: string): Promise<ClassRow> {
    const rows = await this.list(user);
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) {
      throw new NotFoundException('That class does not exist.');
    }
    return row;
  }

  async create(dto: CreateClassDto): Promise<Record<string, unknown>> {
    return this.prisma.class.create({
      data: {
        name: dto.name.trim(),
        code: dto.code?.trim() ?? '',
        faculty: dto.faculty?.trim() ?? '',
        term: dto.term?.trim() ?? '',
        seatCap: dto.seatCap ?? 30,
      },
    });
  }

  async update(id: string, dto: UpdateClassDto): Promise<Record<string, unknown>> {
    const existing = await this.prisma.class.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('That class does not exist.');
    }
    return this.prisma.class.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.faculty !== undefined ? { faculty: dto.faculty.trim() } : {}),
        ...(dto.term !== undefined ? { term: dto.term.trim() } : {}),
        ...(dto.seatCap !== undefined ? { seatCap: dto.seatCap } : {}),
      },
    });
  }
}
