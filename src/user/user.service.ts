import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateUserDto {
  chatId: string;
  identifier: string;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: CreateUserDto) {
    this.logger.log(`Creating user with chatId: ${data.chatId}`);
    return this.prisma.user.create({ data });
  }

  async findByChatId(chatId: string) {
    return this.prisma.user.findUnique({ where: { chatId } });
  }

  async findByIdentifier(identifier: string) {
    return this.prisma.user.findUnique({ where: { identifier } });
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async upsert(chatId: string, identifier: string) {
    this.logger.log(`Upserting user with chatId: ${chatId}, identifier: ${identifier}`);
    return this.prisma.user.upsert({
      where: { chatId },
      update: { identifier },
      create: { chatId, identifier },
    });
  }
}
