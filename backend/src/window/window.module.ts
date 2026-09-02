import { Global, Module } from '@nestjs/common';
import { WindowController } from './window.controller';
import { WindowService } from './window.service';

@Global()
@Module({
  controllers: [WindowController],
  providers: [WindowService],
  exports: [WindowService],
})
export class WindowModule {}
