import { DataSource, DataSourceOptions } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config({
  path: process.env.NODE_ENV !== undefined ? `.${process.env.NODE_ENV.trim()}.env` : ".env",
});

const Config: DataSourceOptions = {
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [__dirname + "/../database/universal/entities/*{.ts,.js}"],
  migrations: [__dirname + "/../database/universal/migrations/*{.ts,.js}"],
  synchronize: false,
  migrationsRun: true,
  logging: false,
};

export const AppDataSource: DataSource = new DataSource(Config);
