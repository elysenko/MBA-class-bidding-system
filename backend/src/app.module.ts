import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AccountsModule } from './accounts/accounts.module';
import { ClassesModule } from './classes/classes.module';
import { WindowModule } from './window/window.module';
import { BidsModule } from './bids/bids.module';
import { ResolutionModule } from './resolution/resolution.module';
import { ResultsModule } from './results/results.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    AuthModule,
    IntegrationsModule,
    HealthModule,
    AccountsModule,
    ClassesModule,
    WindowModule,
    BidsModule,
    ResolutionModule,
    ResultsModule,
    AdminModule,
  ],
})
export class AppModule {}
