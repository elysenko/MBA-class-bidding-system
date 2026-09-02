import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityService } from '../auth/security.service';
import { ResendService } from '../integrations/resend.service';
import { CreateAdminDto, CreateStudentDto } from '../auth/auth.dto';

const TOKEN_TTL_DAYS = Number(process.env.TOKEN_TTL_DAYS ?? 7);

export interface StudentRow {
  id: string;
  name: string;
  email: string;
  pointBalance: number;
  activeBids: number;
  tokenState: 'pending' | 'used' | 'expired';
  emailDelivered: boolean;
  createdAt: string;
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    private readonly resend: ResendService,
  ) {}

  private tokenExpiry(): Date {
    return new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  /**
   * Issues a fresh single-use token, invalidating any earlier unused one, then
   * emails it. The token row is committed before the send is attempted so a
   * delivery failure never loses the account.
   */
  async issueToken(user: User): Promise<{ delivered: boolean; token: string }> {
    const token = this.security.generateLoginToken();
    await this.prisma.$transaction(async (tx) => {
      await tx.loginToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.loginToken.create({
        data: {
          userId: user.id,
          tokenHash: this.security.hashToken(token),
          expiresAt: this.tokenExpiry(),
        },
      });
    });

    const delivered = await this.resend.sendLoginToken(
      user.email,
      user.name ?? user.email,
      token,
    );
    await this.prisma.loginToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { delivered },
    });
    return { delivered, token };
  }

  async createStudent(dto: CreateStudentDto): Promise<{ student: StudentRow; delivered: boolean }> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A student with that email already exists.');
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        role: 'USER',
        pointBalance: dto.pointBalance ?? 1000,
      },
    });
    const { delivered } = await this.issueToken(user);
    const rows = await this.listStudents();
    const student = rows.find((row) => row.id === user.id)!;
    return { student, delivered };
  }

  async resendToken(id: string): Promise<{ student: StudentRow; delivered: boolean }> {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'USER' } });
    if (!user) {
      throw new NotFoundException('That student does not exist.');
    }
    const { delivered } = await this.issueToken(user);
    const rows = await this.listStudents();
    const student = rows.find((row) => row.id === user.id)!;
    return { student, delivered };
  }

  async createAdmin(dto: CreateAdminDto): Promise<Record<string, unknown>> {
    const username = dto.username.trim().toLowerCase();
    const email = (dto.email ?? `${username}@admin.local`).trim().toLowerCase();
    const clash = await this.prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (clash) {
      throw new ConflictException('That username is already taken.');
    }
    const admin = await this.prisma.user.create({
      data: {
        username,
        email,
        name: dto.username.trim(),
        role: 'ADMIN',
        isRoot: dto.isRoot ?? false,
        passwordHash: await this.security.hashPassword(dto.password),
        pointBalance: 0,
      },
    });
    return this.toAdminRow(admin);
  }

  async listAdmins(): Promise<Array<Record<string, unknown>>> {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      orderBy: [{ isRoot: 'desc' }, { createdAt: 'asc' }],
    });
    return admins.map((admin) => this.toAdminRow(admin));
  }

  async listStudents(): Promise<StudentRow[]> {
    const students = await this.prisma.user.findMany({
      where: { role: 'USER' },
      orderBy: { createdAt: 'desc' },
      include: {
        bids: { where: { status: 'ACTIVE' }, select: { id: true } },
        loginTokens: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    return students.map((student) => {
      const latest = student.loginTokens[0];
      const tokenState: StudentRow['tokenState'] = !latest
        ? 'pending'
        : latest.usedAt
          ? 'used'
          : latest.expiresAt.getTime() < Date.now()
            ? 'expired'
            : 'pending';
      return {
        id: student.id,
        name: student.name ?? student.email,
        email: student.email,
        pointBalance: student.pointBalance,
        activeBids: student.bids.length,
        tokenState,
        emailDelivered: latest ? latest.delivered || !!latest.usedAt : false,
        createdAt: student.createdAt.toISOString(),
      };
    });
  }

  private toAdminRow(admin: User): Record<string, unknown> {
    return {
      id: admin.id,
      username: admin.username ?? admin.email,
      email: admin.email,
      isRoot: admin.isRoot,
      lastLoginAt: admin.lastLoginAt ? admin.lastLoginAt.toISOString() : null,
      createdAt: admin.createdAt.toISOString(),
    };
  }
}
