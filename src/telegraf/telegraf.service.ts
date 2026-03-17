import { Injectable, Logger } from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';
import { HttpsProxyAgent } from 'https-proxy-agent';

@Injectable()
export class TelegrafService {
  private readonly logger = new Logger(TelegrafService.name);
  private bot: Telegraf<Context> | null = null;
  private isRunning = false;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const proxyUrl = process.env.TELEGRAM_PROXY_URL;

    this.logger.log(`Token present: ${!!token}`);
    this.logger.log(`Proxy URL: ${proxyUrl || 'none'}`);

    if (token) {
      const options: any = {};

      // Configure proxy if provided
      if (proxyUrl) {
        this.logger.log(`Using proxy: ${proxyUrl}`);
        try {
          // Use dynamic import for socks-proxy-agent (ES module)
          if (proxyUrl.startsWith('socks')) {
            // Lazy load socks-proxy-agent
            const { SocksProxyAgent } = require('socks-proxy-agent');
            options.agent = new SocksProxyAgent(proxyUrl);
          } else {
            options.agent = new HttpsProxyAgent(proxyUrl);
          }
          this.logger.log('Proxy configured successfully');
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Failed to configure proxy: ${errorMessage}`);
        }
      }

      this.bot = new Telegraf<Context>(token, options);
      this.logger.log('Telegraf instance created');
    } else {
      this.logger.warn(
        'Telegram bot token not provided. Bot will not function.',
      );
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
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error sending message to ${chatId}: ${errorMessage}`);
      throw error;
    }
  }

  async launch(): Promise<void> {
    this.logger.log('Launch called (no-op, using SimplePollingService)');
    
    if (!this.bot) {
      this.logger.error('Bot not initialized, cannot launch');
      throw new Error('Bot not initialized');
    }

    if (this.isRunning) {
      this.logger.warn('Bot is already running');
      return;
    }

    // No-op - polling is handled by SimplePollingService
    this.isRunning = true;
    this.logger.log('Bot marked as running (SimplePollingService handles polling)');
  }

  stop(): void {
    this.logger.log('Stop called');
    
    if (!this.bot) {
      this.logger.warn('Bot not initialized');
      return;
    }

    if (!this.isRunning) {
      this.logger.warn('Bot is not running');
      return;
    }

    try {
      this.bot.stop();
      this.isRunning = false;
      this.logger.log('Telegram bot stopped');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error stopping bot: ${errorMessage}`);
    }
  }
}
