import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { CalendarService } from '../calendar/calendar.service';
import * as https from 'https';

@Injectable()
export class SimplePollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SimplePollingService.name);
  private isRunning = false;
  private offset = 0;

  constructor(
    private userService: UserService,
    private calendarService: CalendarService,
  ) {}

  async onModuleInit(): Promise<void> {
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

  private async initializeOffset(): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    return new Promise((resolve) => {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=-1&limit=1`;
      
      https.get(url, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data) as TelegramUpdatesResponse;
            if (parsed.ok && parsed.result.length > 0) {
              this.offset = parsed.result[parsed.result.length - 1].update_id + 1;
              this.logger.log(`Initialized offset to ${this.offset}`);
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
      }).on('error', (err) => {
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

    return new Promise((resolve) => {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${this.offset}&timeout=0&allowed_updates=message`;
      
      https.get(url, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data) as TelegramUpdatesResponse;
            
            if (!parsed.ok) {
              this.logger.error(`Telegram API error: ${parsed.description}`);
              resolve();
              return;
            }

            for (const update of parsed.result) {
              this.offset = update.update_id + 1;

              if (update.message?.text) {
                this.handleMessage(update.message).catch((err) => {
                  this.logger.error(`Error handling message: ${err.message}`);
                });
              }
            }
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`Parse error: ${errorMessage}`);
          }
          resolve();
        });
      }).on('error', (err: Error & { code?: string }) => {
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
        await this.sendMessage(chatId,
          `Привет! Вы уже зарегистрированы.\n` +
          `Ваш идентификатор: \`${existingUser.identifier}\`\n\n` +
          `Используйте /me чтобы проверить данные`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      await this.sendMessage(chatId,
        'Привет! Я бот для напоминаний о занятиях.\n\n' +
        'Пожалуйста, отправьте ваш email или телефон для привязки к расписанию.'
      );
      return;
    }

    if (text === '/me') {
      const user = await this.userService.findByChatId(chatId);
      if (!user) {
        await this.sendMessage(chatId, 'Вы еще не зарегистрированы. Используйте /start.');
        return;
      }
      await this.sendMessage(chatId,
        `*Ваши данные:*\n` +
        `ID: \`${user.id}\`\n` +
        `Chat ID: \`${user.chatId}\`\n` +
        `Идентификатор: \`${user.identifier}\``,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (text === '/help') {
      await this.sendMessage(chatId,
        '*Доступные команды:*\n\n' +
        '/start - Начать работу\n' +
        '/me - Показать ваши данные\n' +
        '/register - Перерегистрироваться\n' +
        '/help - Показать справку',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Handle registration
    const user = await this.userService.findByChatId(chatId);
    if (!user) {
      await this.userService.create({ chatId, identifier: text });
      this.logger.log(`Registered new user: chatId=${chatId}, identifier=${text}`);
      await this.sendMessage(chatId,
        `✅ Вы успешно зарегистрированы!\n` +
        `Идентификатор: \`${text}\`\n\n` +
        `Теперь вы будете получать напоминания о занятиях.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Update identifier
    await this.userService.upsert(chatId, text);
    this.logger.log(`Updated user: chatId=${chatId}, identifier=${text}`);
    await this.sendMessage(chatId,
      `✅ Данные обновлены!\n` +
      `Новый идентификатор: \`${text}\``,
      { parse_mode: 'Markdown' }
    );
  }

  private async sendMessage(
    chatId: string,
    text: string,
    extra?: { parse_mode?: string }
  ): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    return new Promise((resolve) => {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const postData = JSON.stringify({ chat_id: chatId, text, ...extra });
      
      this.logger.debug(`Sending message to ${chatId}: ${text.substring(0, 50)}...`);
      
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 5000,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
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
      });
      
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
