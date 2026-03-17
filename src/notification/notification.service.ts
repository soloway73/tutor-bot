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
      const alreadySent = await this.sentNotificationService.wasSent(event.id, user.id);
      if (alreadySent) {
        this.logger.debug(`Notification already sent for eventId=${event.id}, userId=${user.id}`);
        return;
      }

      // Format event start time
      const startTime = event.start?.dateTime || event.start?.date;
      const startDate = startTime ? new Date(startTime) : null;
      const timeString = startDate
        ? startDate.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'время не указано';

      // Send message
      const message = `📚 *Напоминание о занятии*\n\n` +
        `*Тема:* ${event.summary || 'Без названия'}\n` +
        `*Время:* ${timeString}\n\n` +
        `Не забудьте подготовиться к занятию!`;

      await this.telegrafService.sendMessage(user.chatId, message, { parse_mode: 'Markdown' });

      // Mark as sent
      await this.sentNotificationService.markSent(event.id, user.id);

      this.logger.log(`Reminder sent to user ${user.id} for event ${event.id}`);
    } catch (error) {
      this.logger.error(`Error sending reminder: ${error.message}`, error.stack);
    }
  }
}
