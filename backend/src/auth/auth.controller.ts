import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { AdminLoginDto, DemoLoginDto, SignupDto, StudentLoginDto } from './auth.dto';
import { CurrentUser } from './current-user.decorator';
import { SessionGuard } from './guards';
import { SecurityService } from './security.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly security: SecurityService,
    private readonly prisma: PrismaService,
  ) {}

  private issue(res: Response, user: User): Record<string, unknown> {
    const { token, maxAge } = this.security.signSession(user.id, user.role);
    this.security.setSessionCookie(res, token, maxAge);
    return { identity: this.auth.identity(user), token };
  }

  @Post('admin/login')
  @HttpCode(200)
  async adminLogin(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, unknown>> {
    const user = await this.auth.authenticateAdmin(dto.username, dto.password);
    return this.issue(res, user);
  }

  @Post('student/login')
  @HttpCode(200)
  async studentLogin(
    @Body() dto: StudentLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, unknown>> {
    const user = await this.auth.authenticateStudent(dto.token);
    return this.issue(res, user);
  }

  /**
   * "Skip login — Demo Mode" in the approved UI. Signs in as a pre-seeded demo
   * account only; it can never create one, and it is disabled by setting
   * ALLOW_DEMO_LOGIN=false.
   */
  @Post('demo-login')
  @HttpCode(200)
  async demoLogin(
    @Body() dto: DemoLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, unknown>> {
    if ((process.env.ALLOW_DEMO_LOGIN ?? 'true').toLowerCase() === 'false') {
      throw new ForbiddenException('Demo sign-in is disabled on this deployment.');
    }
    const wantsAdmin = dto.role === 'admin';
    const user = wantsAdmin
      ? await this.prisma.user.findFirst({
          where: { role: 'ADMIN' },
          orderBy: [{ isRoot: 'desc' }, { createdAt: 'asc' }],
        })
      : await this.prisma.user.findFirst({
          where: { role: 'USER' },
          orderBy: { createdAt: 'asc' },
        });
    if (!user) {
      throw new UnauthorizedException(
        wantsAdmin
          ? 'No administrator account exists yet.'
          : 'No student account exists yet. Ask an administrator to create one.',
      );
    }
    return this.issue(res, user);
  }

  /**
   * Public signup is off by default: the registrar provisions every account.
   * The route exists so the flag can be flipped without a code change.
   */
  @Post('signup')
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, unknown>> {
    if ((process.env.ALLOW_PUBLIC_SIGNUP ?? 'false').toLowerCase() !== 'true') {
      throw new ForbiddenException(
        'Public signup is disabled. Accounts are created by the registrar — contact an administrator to be enrolled.',
      );
    }
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ForbiddenException('An account with that email already exists.');
    }
    const isFirstUser = (await this.prisma.user.count()) === 0;
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        role: isFirstUser ? 'ADMIN' : 'USER',
        isRoot: isFirstUser,
        username: isFirstUser ? email : null,
        passwordHash: dto.password ? await this.security.hashPassword(dto.password) : null,
        pointBalance: 1000,
      },
    });
    return this.issue(res, user);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    this.security.clearSessionCookie(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: User): Record<string, unknown> {
    return this.auth.identity(user);
  }
}
