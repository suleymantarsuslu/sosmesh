import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';

@Injectable()
export class NotificationInboxService {
  constructor(private readonly prisma: PrismaService) {}

  async listNotifications(
    user: OperatorRequestUser,
    query: { unreadOnly?: boolean }
  ): Promise<{
    items: {
      id: string;
      eventType: string;
      title: string;
      body: string;
      readAt: string | null;
      createdAt: string;
      deliveryState: string;
    }[];
  }> {
    const rows = await this.prisma.operatorNotification.findMany({
      where: {
        userId: user.sub,
        ...(query.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        eventType: row.eventType,
        title: row.title,
        body: row.body,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        deliveryState: row.deliveryState,
      })),
    };
  }

  async markRead(user: OperatorRequestUser, notificationId: string): Promise<void> {
    await this.prisma.operatorNotification.updateMany({
      where: { id: notificationId, userId: user.sub },
      data: { readAt: new Date() },
    });
  }

  async getPreferences(user: OperatorRequestUser) {
    const prefs = await this.prisma.notificationPreference.upsert({
      where: { userId: user.sub },
      create: { userId: user.sub },
      update: {},
    });
    const subs = await this.prisma.notificationSubscription.findMany({
      where: { userId: user.sub },
    });
    return {
      inAppEnabled: prefs.inAppEnabled,
      emailEnabled: prefs.emailEnabled,
      quietHoursStart: prefs.quietHoursStart,
      quietHoursEnd: prefs.quietHoursEnd,
      subscriptions: subs.map((s) => ({
        eventType: s.eventType,
        enabled: s.enabled,
      })),
    };
  }

  async updatePreferences(
    user: OperatorRequestUser,
    input: {
      inAppEnabled?: boolean;
      emailEnabled?: boolean;
      quietHoursStart?: number | null;
      quietHoursEnd?: number | null;
      subscriptions?: { eventType: string; enabled: boolean }[];
    }
  ) {
    await this.prisma.notificationPreference.upsert({
      where: { userId: user.sub },
      create: {
        userId: user.sub,
        inAppEnabled: input.inAppEnabled ?? true,
        emailEnabled: input.emailEnabled ?? false,
        quietHoursStart: input.quietHoursStart ?? null,
        quietHoursEnd: input.quietHoursEnd ?? null,
      },
      update: {
        ...(input.inAppEnabled !== undefined ? { inAppEnabled: input.inAppEnabled } : {}),
        ...(input.emailEnabled !== undefined ? { emailEnabled: input.emailEnabled } : {}),
        ...(input.quietHoursStart !== undefined
          ? { quietHoursStart: input.quietHoursStart }
          : {}),
        ...(input.quietHoursEnd !== undefined ? { quietHoursEnd: input.quietHoursEnd } : {}),
      },
    });

    if (input.subscriptions) {
      for (const sub of input.subscriptions) {
        await this.prisma.notificationSubscription.upsert({
          where: {
            userId_eventType: { userId: user.sub, eventType: sub.eventType },
          },
          create: {
            userId: user.sub,
            eventType: sub.eventType,
            enabled: sub.enabled,
          },
          update: { enabled: sub.enabled },
        });
      }
    }

    return this.getPreferences(user);
  }
}
