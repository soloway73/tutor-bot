import { Injectable, Logger } from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';

@Injectable()
export class TelegrafService {
  private readonly logger = new Logger(TelegrafService.name);
  private bot: Telegraf<Context>;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      this.bot = new Telegraf<Context>(token);
    } else {
      this.logger.warn('Telegram bot token not provided. Bot will not function.');
    }
  }

  getBot(): Telegraf<Context> | null {
    return this.bot || null;
  }

  async sendMessage(chatId: string, text: string, extra?: any): Promise<void> {
    if (!this.bot) {
      this.logger.warn('Bot not initialized, cannot send message');
      return;
    }

    try {
      await this.bot.telegram.sendMessage(chatId, text, extra);
      this.logger.debug(`Message sent to chat ${chatId}`);
    } catch (error) {
      this.logger.error(`Error sending message to ${chatId}: ${error.message}`);
      throw error;
    }
  }

  async launch(): Promise<void> {
    if (!this.bot) {
      this.logger.warn('Bot not initialized, cannot launch');
      return;
    }

    try {
      await this.bot.launch();
      this.logger.log('Telegram bot launched successfully');
    } catch (error) {
      this.logger.error(`Error launching bot: ${error.message}`, error.stack);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.bot) {
      return;
    }

    try {
      await this.bot.stop();
      this.logger.log('Telegram bot stopped');
    } catch (error) {
      this.logger.error(`Error stopping bot: ${error.message}`);
    }
  }
}
