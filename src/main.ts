import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.LOG_LEVEL && process.env.LOG_LEVEL.toLowerCase() === "debug"
        ? ["log", "debug", "error", "verbose", "warn"]
        : ["log", "warn", "error"],
  });

  app.useGlobalPipes(new ValidationPipe());
  await app.listen(5002);
}
bootstrap();
