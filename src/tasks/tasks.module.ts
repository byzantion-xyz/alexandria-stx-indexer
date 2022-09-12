import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscordBotModule } from 'src/discord-bot/discord-bot.module';
import { IndexersModule } from 'src/indexers/indexers.module';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    IndexersModule.register({ chainSymbol: process.env.CHAIN_SYMBOL }), 
    DiscordBotModule
  ],
  providers: [TasksService]
})
export class TasksModule {}
