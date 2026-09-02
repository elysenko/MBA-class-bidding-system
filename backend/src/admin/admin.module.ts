import { Module } from '@nestjs/common';
import { AdminOpsController } from './admin-ops.controller';
import { SettingsController } from './settings.controller';

@Module({
  controllers: [AdminOpsController, SettingsController],
})
export class AdminModule {}
