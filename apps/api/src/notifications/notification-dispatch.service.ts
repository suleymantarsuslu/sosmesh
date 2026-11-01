import { Injectable } from '@nestjs/common';
import { NotificationDeliveryState, WorkTask, WorkTaskStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';

function isQuietHours(now: Date, startMin: number | null, endMin: number | null): boolean {
  if (startMin === null || endMin === null) {
    return false;
  }
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (startMin <= endMin) {
    return minutes >= startMin && minutes < endMin;
  }
  return minutes >= startMin || minutes < endMin;
}

@Injectable()
export class NotificationDispatchService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyTaskEvent(
    actor: OperatorRequestUser,
    task: WorkTask,
    eventType: string
  ): Promise<void> {
    if (!actor.organizationId) {
      return;
    }

    const recipients = await this.prisma.user.findMany({
      where: {
        team: { organizationId: actor.organizationId },
        id: { not: actor.sub },
        role: { in: ['COORDINATOR', 'ADMIN', 'OPERATOR'] },
      },
      select: { id: true },
      take: 50,
    });

    const dedupeKey = `${eventType}:${task.id}:${task.version}:${task.status}`;
    const title =
      task.status === WorkTaskStatus.PROPOSED
        ? 'Görev taslağı'
        : 'Görev güncellendi';
    const body = `${task.title} — durum: ${task.status}`;

    for (const recipient of recipients) {
      await this.deliverInApp(recipient.id, actor.organizationId, {
        dedupeKey,
        eventType,
        title,
        body,
      });
    }
  }

  async deliverInApp(
    userId: string,
    organizationId: string,
    payload: { dedupeKey: string; eventType: string; title: string; body: string }
  ): Promise<void> {
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (prefs && !prefs.inAppEnabled) {
      return;
    }

    const sub = await this.prisma.notificationSubscription.findUnique({
      where: {
        userId_eventType: { userId, eventType: payload.eventType },
      },
    });
    if (sub && !sub.enabled) {
      return;
    }

    const now = new Date();
    const quiet = prefs
      ? isQuietHours(now, prefs.quietHoursStart, prefs.quietHoursEnd)
      : false;

    const deliveryState = quiet
      ? NotificationDeliveryState.SKIPPED_QUIET_HOURS
      : NotificationDeliveryState.DELIVERED;

    await this.prisma.operatorNotification.upsert({
      where: {
        userId_dedupeKey: { userId, dedupeKey: payload.dedupeKey },
      },
      create: {
        userId,
        organizationId,
        dedupeKey: payload.dedupeKey,
        eventType: payload.eventType,
        title: payload.title,
        body: payload.body,
        deliveryState,
      },
      update: {},
    });
  }
}
