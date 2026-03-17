import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { TelegrafService } from './telegraf.service';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    private telegrafService: TelegrafService,
  ) {}

  async onModuleInit() {
    // Launch is now a no-op, polling is handled by SimplePollingService
    try {
      await this.telegrafService.launch();
      this.logger.log('Telegram bot initialized (using SimplePollingService)');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to initialize bot: ${errorMessage}`);
    }
  }

  onModuleDestroy() {
    this.telegrafService.stop();
  }
}
