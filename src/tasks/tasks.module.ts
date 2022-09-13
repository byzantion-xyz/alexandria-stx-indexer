import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IndexersModule } from 'src/indexers/indexers.module';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    IndexersModule.register({ chainSymbol: process.env.CHAIN_SYMBOL })
  ],
  providers: [TasksService]
})
export class TasksModule {}
