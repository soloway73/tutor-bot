import { Injectable, Logger } from '@nestjs/common';
import { TelegrafService } from '../telegraf/telegraf.service';
import { CalendarEvent } from '../calendar/calendar.service';
import { SentNotificationService } from './sent-notification.service';
import { UserService } from '../user/user.service';
import { DateTimeEntityService } from '../telegraf/date-time-entity.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private botToken: string;

  constructor(
    private telegrafService: TelegrafService,
    private sentNotificationService: SentNotificationService,
    private userService: UserService,
    private dateTimeEntityService: DateTimeEntityService,
  ) {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  }

  /**
   * Send lesson reminder to user using direct API call with proxy
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

      // Create date_time entity for interactive date (Bot API 9.5+)
      const entities: any[] = [];
      if (startDate && !isNaN(startDate.getTime())) {
        const unixTime = this.dateTimeEntityService.isoToUnix(startTime);
        if (unixTime) {
          // Attach date_time entity to the clock emoji (position 0, length 1)
          entities.push({
            type: 'date_time',
            offset: 0,
            length: 1,
            unix_time: unixTime,
          });
        }
      }

      // Send message using direct API call
      const message =
        `📚 *Напоминание о занятии*\n\n` +
        `*Гитарный кабинет*\n` +
        `*Время:* ${timeString} (МСК+1)\n\n` +
        `Не забудьте подготовиться к занятию!`;

      await this.sendMessageWithProxy(user.chatId, message, {
        parse_mode: 'Markdown',
        entities: entities.length > 0 ? entities : undefined,
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

  /**
   * Send message using direct Telegram API call with proxy support
   */
  private async sendMessageWithProxy(
    chatId: string,
    text: string,
    extra?: any,
  ): Promise<void> {
    const proxyUrl = process.env.TELEGRAM_PROXY_URL;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const https = require('https');

    const options: any = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Create agent based on proxy type using hpagent
    if (proxyUrl) {
      const parsedUrl = new URL(proxyUrl);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { HttpsProxyAgent } = require('hpagent');
      
      options.agent = new HttpsProxyAgent({
        proxy: proxyUrl,
        rejectUnauthorized: false,
      });
    }

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => (data += chunk));
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.ok) {
              resolve();
            } else {
              reject(new Error(`Telegram API error: ${result.description}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(
        JSON.stringify({
          chat_id: chatId,
          text,
          ...extra,
        }),
      );
      req.end();
    });
  }
}
