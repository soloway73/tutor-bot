import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdentifierNormalizationService } from './identifier-normalization.service';

export interface CreateUserDto {
  chatId: string;
  identifier: string;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  // Admin identifier (phone number)
  private readonly adminIdentifier = '+79176037035';

  constructor(
    private prisma: PrismaService,
    private normalizationService: IdentifierNormalizationService,
  ) {}

  async create(data: CreateUserDto) {
    const normalizedIdentifier = this.normalizationService.normalize(
      data.identifier,
    );
    this.logger.log(
      `Creating user with chatId: ${data.chatId}, identifier: ${data.identifier} -> ${normalizedIdentifier}`,
    );
    return this.prisma.user.create({
      data: { ...data, identifier: normalizedIdentifier },
    });
  }

  async findByChatId(chatId: string) {
    return this.prisma.user.findUnique({ where: { chatId } });
  }

  async findByIdentifier(identifier: string) {
    const normalized = this.normalizationService.normalize(identifier);
    return this.prisma.user.findUnique({ where: { identifier: normalized } });
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async upsert(chatId: string, identifier: string) {
    const normalizedIdentifier = this.normalizationService.normalize(identifier);
    this.logger.log(
      `Upserting user with chatId: ${chatId}, identifier: ${identifier} -> ${normalizedIdentifier}`,
    );
    return this.prisma.user.upsert({
      where: { chatId },
      update: { identifier: normalizedIdentifier },
      create: { chatId, identifier: normalizedIdentifier },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async count() {
    return this.prisma.user.count();
  }

  isAdmin(user: { identifier: string } | null): boolean {
    if (!user) return false;
    // Normalize phone numbers for comparison
    const normalize = (phone: string) => phone.replace(/\D/g, '');
    return normalize(user.identifier) === normalize(this.adminIdentifier);
  }
}
