import { Module } from '@nestjs/common';
import { BroadcastService } from './broadcast.service';
import { BroadcastController, DeviceBroadcastController, DeviceBroadcastPublicKeyController, DevicePushTokenController } from './broadcast.controller';
import { BroadcastSignerService } from './broadcast-signer.service';
import { PushNotificationService } from './push-notification.service';
import { RegionsController } from './regions.controller';
import { RegionsService } from './regions.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BroadcastService, BroadcastSignerService, PushNotificationService, RegionsService],
  controllers: [BroadcastController, DeviceBroadcastController, DeviceBroadcastPublicKeyController, DevicePushTokenController, RegionsController],
  exports: [BroadcastService, BroadcastSignerService, PushNotificationService, RegionsService],
})
export class BroadcastModule {}
