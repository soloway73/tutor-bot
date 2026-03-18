import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SentNotificationService {
  private readonly logger = new Logger(SentNotificationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Check if notification was already sent for this event and user
   */
  async wasSent(eventId: string, userId: number): Promise<boolean> {
    const existing = await this.prisma.sentNotification.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });
    return !!existing;
  }

  /**
   * Mark notification as sent
   */
  async markSent(eventId: string, userId: number) {
    this.logger.log(
      `Marking notification as sent: eventId=${eventId}, userId=${userId}`,
    );
    return this.prisma.sentNotification.create({
      data: { eventId, userId },
    });
  }

  /**
   * Get total count of sent notifications
   */
  async count(): Promise<number> {
    return this.prisma.sentNotification.count();
  }

  /**
   * Get sent notifications for a specific user (for history)
   */
  async findByUserId(userId: number, limit = 10) {
    return this.prisma.sentNotification.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
      take: limit,
      include: { user: true },
    });
  }
}
