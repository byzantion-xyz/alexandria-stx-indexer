import { Module } from '@nestjs/common';
import { DiscordBotModule } from 'src/discord-bot/discord-bot.module';
import { IndexersModule } from 'src/indexers/indexers.module';
import { TasksService } from './tasks.service';

@Module({
  imports: [IndexersModule, DiscordBotModule],
  providers: [TasksService]
})
export class TasksModule {}
