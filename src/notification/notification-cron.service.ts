import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CalendarService } from '../calendar/calendar.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class NotificationCronService {
  private readonly logger = new Logger(NotificationCronService.name);

  constructor(
    private calendarService: CalendarService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Check for upcoming lessons every 10 minutes
   * Sends reminders for events starting within the next 2 hours
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkLessons(): Promise<void> {
    this.logger.debug('Running scheduled lesson check...');

    try {
      const now = new Date();
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      // Get upcoming events
      const events = await this.calendarService.getUpcomingEvents(
        now,
        twoHoursLater,
      );

      this.logger.log(`Found ${events.length} upcoming events to process`);

      for (const event of events) {
        // Skip all-day events or events without proper timing
        if (!event.start?.dateTime && !event.start?.date) {
          continue;
        }

        // Parse identifier from event
        const identifier = this.calendarService.parseIdentifier(event);
        if (!identifier) {
          this.logger.debug(
            `No identifier found for event: ${event.summary || event.id}`,
          );
          continue;
        }

        // Send reminder
        await this.notificationService.sendReminder(event, identifier);
      }

      this.logger.log('Scheduled lesson check completed');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error in scheduled lesson check: ${errorMessage}`,
        errorStack,
      );
    }
  }
}
