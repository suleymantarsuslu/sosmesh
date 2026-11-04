import { Module } from '@nestjs/common';
import { BroadcastService } from './broadcast.service';
import { BroadcastController, DeviceBroadcastController } from './broadcast.controller';
import { BroadcastSignerService } from './broadcast-signer.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BroadcastService, BroadcastSignerService],
  controllers: [BroadcastController, DeviceBroadcastController],
  exports: [BroadcastService, BroadcastSignerService],
})
export class BroadcastModule {}
