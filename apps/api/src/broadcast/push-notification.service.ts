import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StructuredEventLogger } from '../observability/structured-event-logger.service';
import type { DevicePlatform } from '@prisma/client';

interface PushNotificationPayload {
  broadcastId: string;
  title: string;
  body: string;
  severity: string;
  kind: string;
}

@Injectable()
export class PushNotificationService implements OnModuleInit {
  private fcmEnabled = false;
  private apnsEnabled = false;
  private fcmServiceAccount: any = null;
  private apnsConfig: any = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: StructuredEventLogger
  ) {}

  onModuleInit() {
    const fcmJson = process.env.FCM_SERVICE_ACCOUNT_JSON;
    if (fcmJson) {
      try {
        this.fcmServiceAccount = JSON.parse(fcmJson);
        this.fcmEnabled = true;
      } catch (error) {
        this.logger.emit('push_config_invalid', {
          platform: 'fcm',
          error: 'Failed to parse FCM_SERVICE_ACCOUNT_JSON',
        });
      }
    }

    const apnsKeyP8 = process.env.APNS_KEY_P8;
    const apnsKeyId = process.env.APNS_KEY_ID;
    const apnsTeamId = process.env.APNS_TEAM_ID;
    const apnsBundleId = process.env.APNS_BUNDLE_ID;
    const apnsProduction = process.env.APNS_PRODUCTION === 'true';

    if (apnsKeyP8 && apnsKeyId && apnsTeamId && apnsBundleId) {
      this.apnsConfig = {
        keyP8: apnsKeyP8,
        keyId: apnsKeyId,
        teamId: apnsTeamId,
        bundleId: apnsBundleId,
        production: apnsProduction,
      };
      this.apnsEnabled = true;
    }

    if (!this.fcmEnabled && !this.apnsEnabled) {
      this.logger.emit('push_notifications_disabled', {
        reason: 'Missing FCM_SERVICE_ACCOUNT_JSON and APNs environment variables',
      });
    }
  }

  async sendBroadcastNotifications(payload: PushNotificationPayload): Promise<void> {
    if (!this.fcmEnabled && !this.apnsEnabled) {
      return;
    }

    const tokens = await this.prisma.devicePushToken.findMany({
      select: {
        id: true,
        platform: true,
        token: true,
      },
    });

    const androidTokens = tokens.filter(t => t.platform === 'android').map(t => ({ id: t.id, token: t.token }));
    const iosTokens = tokens.filter(t => t.platform === 'ios').map(t => ({ id: t.id, token: t.token }));

    await Promise.all([
      this.sendFcmNotifications(androidTokens, payload),
      this.sendApnsNotifications(iosTokens, payload),
    ]);
  }

  private async sendFcmNotifications(
    tokens: Array<{ id: string; token: string }>,
    payload: PushNotificationPayload
  ): Promise<void> {
    if (!this.fcmEnabled || tokens.length === 0) {
      return;
    }

    const accessToken = await this.getFcmAccessToken();
    if (!accessToken) {
      return;
    }

    const projectId = this.fcmServiceAccount.project_id;
    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    for (const { id, token } of tokens) {
      try {
        const message = {
          message: {
            token,
            data: {
              broadcastId: payload.broadcastId,
              kind: payload.kind,
            },
            notification: {
              title: payload.title,
              body: payload.body,
            },
            android: {
              priority: 'high',
            },
          },
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 404 || response.status === 410 || errorText.includes('UNREGISTERED')) {
            await this.removeInvalidToken(id);
          }
        }
      } catch (error) {
        // Continue with other tokens
      }
    }
  }

  private async sendApnsNotifications(
    tokens: Array<{ id: string; token: string }>,
    payload: PushNotificationPayload
  ): Promise<void> {
    if (!this.apnsEnabled || tokens.length === 0) {
      return;
    }

    const jwtToken = this.generateApnsJwt();
    if (!jwtToken) {
      return;
    }

    const host = this.apnsConfig.production ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
    const url = `https://${host}/3/device`;

    for (const { id, token } of tokens) {
      try {
        const apnsPayload = {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
            sound: 'default',
          },
          broadcastId: payload.broadcastId,
          kind: payload.kind,
        };

        const response = await fetch(`${url}/${token}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${jwtToken}`,
            'apns-topic': this.apnsConfig.bundleId,
            'apns-priority': '10',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(apnsPayload),
        });

        if (!response.ok) {
          const status = response.status;
          if (status === 404 || status === 410) {
            await this.removeInvalidToken(id);
          }
        }
      } catch (error) {
        // Continue with other tokens
      }
    }
  }

  private async getFcmAccessToken(): Promise<string | null> {
    try {
      const jwtHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const now = Math.floor(Date.now() / 1000);
      const jwtClaim = Buffer.from(JSON.stringify({
        iss: this.fcmServiceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      })).toString('base64url');

      const crypto = await import('crypto');
      const signData = `${jwtHeader}.${jwtClaim}`;
      const signature = crypto.createSign('RSA-SHA256')
        .update(signData)
        .sign(this.fcmServiceAccount.private_key, 'base64url');

      const jwt = `${signData}.${signature}`;

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      return null;
    }
  }

  private generateApnsJwt(): string | null {
    try {
      const crypto = require('crypto');
      const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: this.apnsConfig.keyId })).toString('base64url');
      const now = Math.floor(Date.now() / 1000);
      const payload = Buffer.from(JSON.stringify({
        iss: this.apnsConfig.teamId,
        iat: now,
      })).toString('base64url');

      const signData = `${header}.${payload}`;
      const sign = crypto.createSign('SHA256');
      sign.update(signData);
      sign.end();
      const signature = sign.sign(this.apnsConfig.keyP8, 'base64url');

      return `${signData}.${signature}`;
    } catch (error) {
      return null;
    }
  }

  private async removeInvalidToken(tokenId: string): Promise<void> {
    try {
      await this.prisma.devicePushToken.delete({
        where: { id: tokenId },
      });
    } catch (error) {
      // Token might already be deleted
    }
  }

  async registerToken(platform: DevicePlatform, token: string, deviceId: string): Promise<void> {
    await this.prisma.devicePushToken.upsert({
      where: {
        platform_deviceId: {
          platform,
          deviceId,
        },
      },
      update: {
        token,
        updatedAt: new Date(),
      },
      create: {
        platform,
        token,
        deviceId,
      },
    });
  }
}
