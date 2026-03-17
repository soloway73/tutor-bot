import { Module, forwardRef } from '@nestjs/common';
import { TelegrafService } from './telegraf.service';
import { TelegramBotService } from './telegram-bot.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  providers: [TelegrafService, TelegramBotService],
  exports: [TelegrafService],
})
export class TelegrafModule {}
