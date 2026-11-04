import { Module } from '@nestjs/common';
import { BroadcastService } from './broadcast.service';
import { BroadcastController, DeviceBroadcastController, DeviceBroadcastPublicKeyController } from './broadcast.controller';
import { BroadcastSignerService } from './broadcast-signer.service';
import { RegionsController } from './regions.controller';
import { RegionsService } from './regions.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BroadcastService, BroadcastSignerService, RegionsService],
  controllers: [BroadcastController, DeviceBroadcastController, DeviceBroadcastPublicKeyController, RegionsController],
  exports: [BroadcastService, BroadcastSignerService, RegionsService],
})
export class BroadcastModule {}
