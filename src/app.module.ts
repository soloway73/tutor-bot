import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { CalendarModule } from './calendar/calendar.module';
import { TelegrafModule } from './telegraf/telegraf.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    // ConfigModule - load .env files
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // ScheduleModule - enable cron jobs
    ScheduleModule.forRoot(),
    // Database
    PrismaModule,
    // Feature modules
    UserModule,
    CalendarModule,
    TelegrafModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
