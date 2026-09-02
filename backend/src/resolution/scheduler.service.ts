import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ResolutionService } from './resolution.service';

/**
 * Polls every 10 seconds so seats are awarded within 10s of the window closing,
 * even if nobody is using the app. Overlapping runs are suppressed locally and,
 * across replicas, by the advisory lock inside `resolveWindow()`.
 */
@Injectable()
export class ResolutionSchedulerService {
  private readonly logger = new Logger(ResolutionSchedulerService.name);
  private running = false;

  constructor(private readonly resolution: ResolutionService) {}

  @Interval('bid-resolution', 10_000)
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const outcome = await this.resolution.resolveWindow();
      if (outcome.resolved) {
        this.logger.log('Seats awarded automatically at window close.');
      }
    } catch (error) {
      this.logger.error(`Scheduled resolution failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
