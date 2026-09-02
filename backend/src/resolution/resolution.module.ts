import { Global, Module } from '@nestjs/common';
import { ResolutionService } from './resolution.service';
import { ResolutionSchedulerService } from './scheduler.service';

@Global()
@Module({
  providers: [ResolutionService, ResolutionSchedulerService],
  exports: [ResolutionService],
})
export class ResolutionModule {}
