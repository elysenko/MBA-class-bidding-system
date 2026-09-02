import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminGuard, RootAdminGuard, SessionGuard, StudentGuard } from './guards';
import { SecurityService } from './security.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SecurityService,
    SessionGuard,
    AdminGuard,
    RootAdminGuard,
    StudentGuard,
  ],
  exports: [AuthService, SecurityService, SessionGuard, AdminGuard, RootAdminGuard, StudentGuard],
})
export class AuthModule {}
