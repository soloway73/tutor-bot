import { Injectable, Logger } from '@nestjs/common';
import { TelegrafService } from '../telegraf/telegraf.service';
import { CalendarEvent } from '../calendar/calendar.service';
import { SentNotificationService } from './sent-notification.service';
import { UserService } from '../user/user.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private telegrafService: TelegrafService,
    private sentNotificationService: SentNotificationService,
    private userService: UserService,
  ) {}

  /**
   * Send lesson reminder to user
   */
  async sendReminder(event: CalendarEvent, identifier: string): Promise<void> {
    try {
      // Find user by identifier
      const user = await this.userService.findByIdentifier(identifier);
      if (!user) {
        this.logger.debug(`No user found for identifier: ${identifier}`);
        return;
      }

      // Check if already sent
      const alreadySent = await this.sentNotificationService.wasSent(
        event.id,
        user.id,
      );
      if (alreadySent) {
        this.logger.debug(
          `Notification already sent for eventId=${event.id}, userId=${user.id}`,
        );
        return;
      }

      // Format event start time (GMT+4 timezone)
      const startTime = event.start?.dateTime || event.start?.date;
      const startDate = startTime ? new Date(startTime) : null;
      const timeString = startDate
        ? startDate.toLocaleString('ru-RU', {
            timeZone: 'Europe/Samara',  // GMT+4
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'время не указано';

      // Send message
      const message =
        `📚 *Напоминание о занятии*\n\n` +
        `*Гитарный кабинет*\n` +
        `*Время:* ${timeString} (МСК+1)\n\n` +
        `Не забудьте подготовиться к занятию!`;

      await this.telegrafService.sendMessage(user.chatId, message, {
        parse_mode: 'Markdown',
      });

      // Mark as sent
      await this.sentNotificationService.markSent(event.id, user.id);

      this.logger.log(`Reminder sent to user ${user.id} for event ${event.id}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error sending reminder: ${errorMessage}`, errorStack);
    }
  }
}
