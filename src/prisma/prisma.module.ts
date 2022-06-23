import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaStreamerService } from './prisma-streamer.service';
import { PrismaService } from './prisma.service';

@Module({  
    imports: [ConfigModule],
    providers: [
        PrismaService,
        PrismaStreamerService
    ],
    exports: [PrismaService, PrismaStreamerService]
})
export class PrismaModule {}
