import { Module } from "@nestjs/common";
import { IndexersModule } from "src/indexers/indexers.module";
import { TasksService } from "./tasks.service";

@Module({
  imports: [IndexersModule],
  providers: [TasksService],
})
export class TasksModule {}
