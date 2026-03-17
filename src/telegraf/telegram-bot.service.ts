import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';
import { TelegrafService } from './telegraf.service';
import { UserService } from '../user/user.service';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Telegraf<Context> | null = null;

  constructor(
    private telegrafService: TelegrafService,
    private userService: UserService,
  ) {}

  async onModuleInit() {
    this.bot = this.telegrafService.getBot();
    if (!this.bot) {
      this.logger.warn('Telegram bot not initialized');
      return;
    }

    this.registerCommands();
    this.registerHandlers();

    // Launch the bot
    await this.telegrafService.launch();
  }

  async onModuleDestroy() {
    await this.telegrafService.stop();
  }

  private registerCommands() {
    if (!this.bot) return;

    // /start command - register user
    this.bot.command('start', async (ctx) => {
      const chatId = String(ctx.chat.id);
      this.logger.log(`Received /start from chat: ${chatId}`);

      const existingUser = await this.userService.findByChatId(chatId);

      if (existingUser) {
        await ctx.reply(
          `Привет! Вы уже зарегистрированы.\n` +
          `Ваш идентификатор: \`${existingUser.identifier}\`\n\n` +
          `Используйте /me чтобы проверить данные\n` +
          `Используйте /register чтобы перерегистрироваться`,
          { parse_mode: 'Markdown' },
        );
        return;
      }

      await ctx.reply(
        'Привет! Я бот для напоминаний о занятиях.\n\n' +
        'Пожалуйста, отправьте ваш email или телефон для привязки к расписанию.',
      );
    });

    // /me command - show user info
    this.bot.command('me', async (ctx) => {
      const chatId = String(ctx.chat.id);
      const user = await this.userService.findByChatId(chatId);

      if (!user) {
        await ctx.reply('Вы еще не зарегистрированы. Используйте /start для регистрации.');
        return;
      }

      await ctx.reply(
        `*Ваши данные:*\n` +
        `ID: \`${user.id}\`\n` +
        `Chat ID: \`${user.chatId}\`\n` +
        `Идентификатор: \`${user.identifier}\`\n` +
        `Зарегистрирован: ${new Date(user.createdAt).toLocaleString('ru-RU')}`,
        { parse_mode: 'Markdown' },
      );
    });

    // /register command - re-register
    this.bot.command('register', async (ctx) => {
      const chatId = String(ctx.chat.id);
      await ctx.reply('Отправьте ваш новый email или телефон для обновления данных.');
    });

    // /help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        '*Доступные команды:*\n\n' +
        '/start - Начать работу с ботом\n' +
        '/me - Показать ваши данные\n' +
        '/register - Перерегистрироваться с новым идентификатором\n' +
        '/help - Показать эту справку',
        { parse_mode: 'Markdown' },
      );
    });
  }

  private registerHandlers() {
    if (!this.bot) return;

    // Handle text messages (for registration)
    this.bot.on('text', async (ctx) => {
      const chatId = String(ctx.chat.id);
      const text = ctx.message.text.trim();

      // Check if user is trying to register
      const user = await this.userService.findByChatId(chatId);
      
      if (!user) {
        // New user registration
        await this.userService.create({ chatId, identifier: text });
        this.logger.log(`Registered new user: chatId=${chatId}, identifier=${text}`);
        await ctx.reply(
          `✅ Вы успешно зарегистрированы!\n` +
          `Идентификатор: \`${text}\`\n\n` +
          `Теперь вы будете получать напоминания о занятиях.`,
          { parse_mode: 'Markdown' },
        );
        return;
      }

      // Check if user used /register command (we can track state, but for simplicity we update)
      // In a more complex scenario, use scenes/states
      await this.userService.upsert(chatId, text);
      this.logger.log(`Updated user: chatId=${chatId}, identifier=${text}`);
      await ctx.reply(
        `✅ Данные обновлены!\n` +
        `Новый идентификатор: \`${text}\``,
        { parse_mode: 'Markdown' },
      );
    });
  }
}
