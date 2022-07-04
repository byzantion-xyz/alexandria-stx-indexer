import { Module } from "@nestjs/common";
import { databaseProviders } from "./providers/database/database.service";

@Module({
  providers: [...databaseProviders],
  exports: [...databaseProviders],
})
export class TypeormModule {}
