import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { CalendarService } from '../calendar/calendar.service';
import { SentNotificationService } from '../notification/sent-notification.service';
import { IdentifierNormalizationService } from '../user/identifier-normalization.service';
import * as https from 'https';

@Injectable()
export class SimplePollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SimplePollingService.name);
  private isRunning = false;
  private offset = 0;
  private agent: any = null;
  // Map to track users waiting for identifier input after /register command
  private pendingRegistrations = new Map<string, boolean>();
  // Map to track admin users waiting for broadcast message
  private pendingBroadcasts = new Map<string, boolean>();

  constructor(
    private userService: UserService,
    private calendarService: CalendarService,
    private sentNotificationService: SentNotificationService,
    private normalizationService: IdentifierNormalizationService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Configure proxy agent if provided
    const proxyUrl = process.env.TELEGRAM_PROXY_URL;
    if (proxyUrl) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { HttpsProxyAgent } = require('hpagent');
        this.agent = new HttpsProxyAgent({
          proxy: proxyUrl,
          rejectUnauthorized: false,
        });
        this.logger.log(`HTTPS proxy agent configured for ${proxyUrl}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to configure proxy agent: ${errorMessage}`);
      }
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.warn('Telegram bot token not provided');
      return;
    }

    this.logger.log('Starting simple polling...');
    this.isRunning = true;

    // Get the last update_id to avoid processing old messages
    await this.initializeOffset();

    // Start polling with recursive setTimeout - this keeps the event loop alive
    this.scheduleNextPoll();

    this.logger.log('Simple polling started');
  }

  private formatEventTime(
    event: import('../calendar/calendar.service').CalendarEvent,
  ): string {
    const startTime = event.start?.dateTime || event.start?.date;
    const startDate = startTime ? new Date(startTime) : null;
    return startDate
      ? startDate.toLocaleString('ru-RU', {
          timeZone: 'Europe/Samara',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'время не указано';
  }

  private async initializeOffset(): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    return new Promise((resolve) => {
      // First, get the latest update to set offset correctly
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=-1&limit=1`;

      const options: https.RequestOptions = {
        timeout: 10000,
      };

      // Use proxy agent if configured
      if (this.agent) {
        options.agent = this.agent;
      }

      https
        .get(url, options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data) as TelegramUpdatesResponse;
              if (parsed.ok && parsed.result.length > 0) {
                // Set offset to next update after the latest one
                this.offset =
                  parsed.result[parsed.result.length - 1].update_id + 1;
                this.logger.log(
                  `Initialized offset to ${this.offset} (skipping old messages)`,
                );
              } else {
                this.offset = 0;
                this.logger.log('No previous updates, starting from 0');
              }
            } catch {
              this.offset = 0;
              this.logger.log('Starting from offset 0');
            }
            resolve();
          });
        })
        .on('error', (err) => {
          this.logger.error(`Failed to initialize offset: ${err.message}`);
          this.offset = 0;
          resolve();
        });
    });
  }

  private scheduleNextPoll(): void {
    if (!this.isRunning) return;

    setTimeout(() => {
      this.poll().finally(() => {
        this.scheduleNextPoll();
      });
    }, 1000);
  }

  onModuleDestroy(): void {
    this.isRunning = false;
    this.logger.log('Simple polling stopped');
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    this.logger.debug(`Polling with offset=${this.offset}`);

    return new Promise((resolve) => {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${this.offset}&timeout=0&allowed_updates=message`;

      const options: https.RequestOptions = {
        timeout: 5000,
      };

      // Use proxy agent if configured
      if (this.agent) {
        options.agent = this.agent;
      }

      https
        .get(url, options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data) as TelegramUpdatesResponse;

              if (!parsed.ok) {
                this.logger.error(`Telegram API error: ${parsed.description}`);
                resolve();
                return;
              }

              this.logger.debug(`Received ${parsed.result.length} updates`);

              for (const update of parsed.result) {
                this.offset = update.update_id + 1;
                this.logger.log(`Processing update ${update.update_id}`);

                if (update.message?.text) {
                  this.handleMessage(update.message).catch((err) => {
                    this.logger.error(`Error handling message: ${err.message}`);
                  });
                }
              }
            } catch (err) {
              const errorMessage =
                err instanceof Error ? err.message : 'Unknown error';
              this.logger.error(`Parse error: ${errorMessage}`);
            }
            resolve();
          });
        })
        .on('error', (err: Error & { code?: string }) => {
          if (err.code !== 'ETIMEDOUT') {
            this.logger.error(`Polling error: ${err.message}`);
          }
          resolve();
        });
    });
  }

  private async handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = String(message.chat.id);
    const text = message.text?.trim();

    this.logger.log(`Received message from ${chatId}: ${text}`);

    if (!text) return;

    if (text === '/start') {
      const existingUser = await this.userService.findByChatId(chatId);
      if (existingUser) {
        await this.sendMessage(
          chatId,
          `Привет! Вы уже зарегистрированы.\n` +
            `Ваш идентификатор: \`${existingUser.identifier}\`\n\n` +
            `Используйте /me чтобы проверить данные`,
          { parse_mode: 'Markdown' },
        );
        return;
      }
      await this.sendMessage(
        chatId,
        'Привет! Я бот для напоминаний о занятиях.\n\n' +
          'Пожалуйста, отправьте ваш email или телефон для привязки к расписанию.',
      );
      return;
    }

    if (text === '/me') {
      const user = await this.userService.findByChatId(chatId);
      if (!user) {
        await this.sendMessage(
          chatId,
          'Вы еще не зарегистрированы. Используйте /start.',
        );
        return;
      }
      await this.sendMessage(
        chatId,
        `*Ваши данные:*\n` +
          `ID: \`${user.id}\`\n` +
          `Chat ID: \`${user.chatId}\`\n` +
          `Идентификатор: \`${user.identifier}\``,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    if (text === '/help') {
      const user = await this.userService.findByChatId(chatId);
      const isAdmin = this.userService.isAdmin(user);

      let helpMessage =
        '*Доступные команды:*\n\n' +
        '/start - Начать работу\n' +
        '/me - Показать ваши данные\n' +
        '/next - Показать 2 ближайших мероприятия\n' +
        '/history - Показать историю занятий (за 30 дней)\n' +
        '/register - Перерегистрироваться\n';

      if (isAdmin) {
        helpMessage +=
          '\n*Админ-команды:*\n' +
          '/stats - Статистика бота\n' +
          '/users - Список всех пользователей\n' +
          '/broadcast - Рассылка сообщения всем\n';
      }

      helpMessage += '\n/help - Показать справку';

      await this.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
      return;
    }

    if (text === '/next') {
      const user = await this.userService.findByChatId(chatId);
      if (!user) {
        await this.sendMessage(
          chatId,
          'Вы еще не зарегистрированы. Используйте /start.',
        );
        return;
      }

      const events = await this.calendarService.getUpcomingEventsByIdentifier(
        user.identifier,
        2,
      );

      if (events.length === 0) {
        await this.sendMessage(
          chatId,
          '📅 На ближайшие 7 дней у вас нет запланированных мероприятий.',
          { parse_mode: 'Markdown' },
        );
        return;
      }

      let message = `📚 *Ближайшие мероприятия (${events.length}):*\n\n`;
      events.forEach((event, index) => {
        const timeString = this.formatEventTime(event);
        message += `*${index + 1}. ${event.summary || 'Без названия'}*\n`;
        message += `🕐 ${timeString} (МСК+1)\n`;
        if (event.description) {
          const shortDesc = event.description.substring(0, 100);
          message += `📝 ${shortDesc}${event.description.length > 100 ? '...' : ''}\n`;
        }
        message += '\n';
      });

      await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      return;
    }

    if (text === '/history') {
      const user = await this.userService.findByChatId(chatId);
      if (!user) {
        await this.sendMessage(
          chatId,
          'Вы еще не зарегистрированы. Используйте /start.',
        );
        return;
      }

      // Get past events from Google Calendar
      const events = await this.calendarService.getRecentPastEvents(16);

      if (events.length === 0) {
        await this.sendMessage(
          chatId,
          '📜 У вас нет истории посещений за последние 90 дней.',
          { parse_mode: 'Markdown' },
        );
        return;
      }

      let message = `📜 *История занятий (последние ${events.length}):*\n\n`;
      events.forEach((event, index) => {
        const startDate = event.start?.dateTime
          ? new Date(event.start.dateTime)
          : event.start?.date
            ? new Date(event.start.date)
            : new Date();

        const dateStr = startDate.toLocaleDateString('ru-RU', {
          timeZone: 'Europe/Samara',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const title = event.summary || 'Без названия';
        const description = event.description
          ? event.description.split('\n').join('\n    ')
          : 'Описание отсутствует';

        message += `*${index + 1}. ${title}*\n`;
        message += `📅 ${dateStr}\n`;
        message += `📝 ${description}\n\n`;
      });

      await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      return;
    }

    // Admin commands
    if (text === '/stats') {
      const user = await this.userService.findByChatId(chatId);
      if (!this.userService.isAdmin(user)) {
        await this.sendMessage(chatId, '⛔️ У вас нет прав администратора.');
        return;
      }

      const userCount = await this.userService.count();
      const notificationCount = await this.sentNotificationService.count();

      await this.sendMessage(
        chatId,
        `📊 *Статистика бота:*\n\n` +
          `👥 Пользователей: ${userCount}\n` +
          `🔔 Отправлено напоминаний: ${notificationCount}`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    if (text === '/users') {
      const user = await this.userService.findByChatId(chatId);
      if (!this.userService.isAdmin(user)) {
        await this.sendMessage(chatId, '⛔️ У вас нет прав администратора.');
        return;
      }

      const allUsers = await this.userService.findAll();

      if (allUsers.length === 0) {
        await this.sendMessage(chatId, '👥 Пользователей пока нет.');
        return;
      }

      let message = `👥 *Пользователи (${allUsers.length}):*\n\n`;
      allUsers.forEach((u, index) => {
        const date = new Date(u.createdAt).toLocaleDateString('ru-RU');
        message += `${index + 1}. \`${u.identifier}\` (chat: ${u.chatId}, с ${date})\n`;
      });

      await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      return;
    }

    if (text === '/broadcast') {
      const user = await this.userService.findByChatId(chatId);
      if (!this.userService.isAdmin(user)) {
        await this.sendMessage(chatId, '⛔️ У вас нет прав администратора.');
        return;
      }

      this.pendingBroadcasts.set(chatId, true);
      await this.sendMessage(
        chatId,
        '📢 Отправьте сообщение для рассылки всем пользователям.',
      );
      return;
    }

    // Handle broadcast message (after /broadcast command)
    if (this.pendingBroadcasts.has(chatId)) {
      const user = await this.userService.findByChatId(chatId);
      if (user && this.userService.isAdmin(user)) {
        // This is a broadcast message
        const allUsers = await this.userService.findAll();
        let successCount = 0;
        let failCount = 0;

        for (const u of allUsers) {
          try {
            await this.sendMessage(u.chatId, text);
            successCount++;
          } catch {
            failCount++;
          }
        }

        await this.sendMessage(
          chatId,
          `✅ Рассылка завершена.\n` +
            `📤 Отправлено: ${successCount}\n` +
            `❌ Ошибок: ${failCount}`,
          { parse_mode: 'Markdown' },
        );
      }
      this.pendingBroadcasts.delete(chatId);
      return;
    }

    if (text === '/register') {
      const user = await this.userService.findByChatId(chatId);
      if (!user) {
        await this.sendMessage(
          chatId,
          'Сначала зарегистрируйтесь через /start',
          { parse_mode: 'Markdown' },
        );
        return;
      }
      this.pendingRegistrations.set(chatId, true);
      await this.sendMessage(
        chatId,
        'Отправьте ваш новый email или телефон для обновления идентификатора.',
      );
      return;
    }

    // Check if user is in pending registration state (after /register command)
    if (this.pendingRegistrations.has(chatId)) {
      const user = await this.userService.findByChatId(chatId);
      if (user) {
        try {
          // Normalize identifier before saving
          const normalizedText = this.normalizationService.normalize(text);
          await this.userService.upsert(chatId, normalizedText);
          this.logger.log(`Updated user: chatId=${chatId}, identifier=${normalizedText}`);
          await this.sendMessage(
            chatId,
            `✅ Данные обновлены!\n` + `Новый идентификатор: \`${normalizedText}\``,
            { parse_mode: 'Markdown' },
          );
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          if (errorMessage.includes('Unique constraint failed')) {
            await this.sendMessage(
              chatId,
              '⚠️ *Ошибка!*\n\n' +
                'Этот идентификатор уже используется другим пользователем.\n\n' +
                'Пожалуйста, отправьте другой email или телефон.',
              { parse_mode: 'Markdown' },
            );
            this.logger.warn(`Identifier duplicate: ${text}`);
          } else {
            await this.sendMessage(
              chatId,
              '⚠️ Произошла ошибка при обновлении данных. Попробуйте позже.',
            );
            this.logger.error(`Error updating user: ${errorMessage}`);
          }
        }
      }
      this.pendingRegistrations.delete(chatId);
      return;
    }

    // Check if user exists
    const user = await this.userService.findByChatId(chatId);
    if (!user) {
      // New user - register with this identifier
      try {
        // Normalize identifier before saving
        const normalizedText = this.normalizationService.normalize(text);
        await this.userService.create({ chatId, identifier: normalizedText });
        this.logger.log(
          `Registered new user: chatId=${chatId}, identifier=${normalizedText}`,
        );
        await this.sendMessage(
          chatId,
          `✅ Вы успешно зарегистрированы!\n` +
            `Идентификатор: \`${normalizedText}\`\n\n` +
            `Теперь отправьте это сообщение своему преподавателю, чтобы получать напоминания о занятиях.`,
          { parse_mode: 'Markdown' },
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('Unique constraint failed')) {
          if (errorMessage.includes('identifier')) {
            await this.sendMessage(
              chatId,
              '⚠️ *Ошибка!*\n\n' +
                'Этот email или телефон уже зарегистрирован в системе.\n\n' +
                'Пожалуйста, отправьте другой идентификатор или используйте /start если вы уже зарегистрированы.',
              { parse_mode: 'Markdown' },
            );
          } else {
            await this.sendMessage(
              chatId,
              '⚠️ *Ошибка!*\n\n' +
                'Этот Telegram аккаунт уже зарегистрирован.\n\n' +
                'Используйте /me для проверки данных или /register для смены идентификатора.',
              { parse_mode: 'Markdown' },
            );
          }
          this.logger.warn(`Registration duplicate: ${errorMessage}`);
        } else {
          await this.sendMessage(
            chatId,
            '⚠️ Произошла ошибка при регистрации. Попробуйте позже.',
          );
          this.logger.error(`Error registering user: ${errorMessage}`);
        }
      }
      return;
    }

    // Registered user - ignore random messages
    await this.sendMessage(
      chatId,
      '⚠️ Неизвестная команда. Используйте /help для просмотра доступных команд.',
    );
  }

  private async sendMessage(
    chatId: string,
    text: string,
    extra?: { parse_mode?: string },
  ): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.error('TELEGRAM_BOT_TOKEN not set');
      return;
    }

    return new Promise((resolve) => {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const postData = JSON.stringify({ chat_id: chatId, text, ...extra });

      this.logger.log(
        `Sending message to ${chatId}: ${text.substring(0, 50)}...`,
      );

      const options: https.RequestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 5000,
      };

      // Use proxy agent if configured
      if (this.agent) {
        options.agent = this.agent;
      }

      const req = https.request(
        url,
        options,
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.ok) {
                this.logger.log(`Message sent to ${chatId}`);
              } else {
                this.logger.error(`sendMessage error: ${parsed.description}`);
              }
            } catch {
              this.logger.error(`sendMessage parse error`);
            }
            resolve();
          });
        },
      );

      req.on('error', (err) => {
        this.logger.error(`Error sending message: ${err.message}`);
        resolve();
      });

      req.on('timeout', () => {
        req.destroy();
        this.logger.error('sendMessage timeout');
        resolve();
      });

      req.write(postData);
      req.end();
    });
  }
}

interface TelegramUpdatesResponse {
  ok: boolean;
  result: Array<{
    update_id: number;
    message?: TelegramMessage;
  }>;
  description?: string;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  text?: string;
  from?: { id: number; first_name?: string };
  date: number;
}
