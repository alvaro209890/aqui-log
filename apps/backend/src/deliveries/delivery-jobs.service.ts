import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DeliveriesService } from './deliveries.service';

@Injectable()
export class DeliveryJobsService {
  private readonly logger = new Logger(DeliveryJobsService.name);
  private running = false;

  constructor(private readonly deliveries: DeliveriesService) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const expired = await this.deliveries.expireStaleOffers();
      const scheduled = await this.deliveries.dispatchDueScheduled();
      if (expired > 0 || scheduled > 0) {
        this.logger.log(
          `jobs: expiredOffers=${expired} scheduledDispatched=${scheduled}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `delivery jobs failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
