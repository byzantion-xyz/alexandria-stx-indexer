import { HttpException, HttpStatus, Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcryptjs";
import { ApiKey } from "src/database/universal/entities/ApiKey";
import { Repository } from "typeorm";

@Injectable()
export class ApiProtectMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApiProtectMiddleware.name);

  constructor(
    @InjectRepository(ApiKey)
    private repo: Repository<ApiKey>
  ) {}

  async use(req: Request, res: Response, next: () => void) {
    if (process.env.RUNTIME_ENV === "development") {
      return next();
    }

    // 1) Check that the appi key exists in the request header
    let prefix, key;
    if (req.headers["x-api-key"]) {
      const fullKey = req.headers["x-api-key"].split(".");
      prefix = fullKey[0];
      key = fullKey[1];
    }
    if (!prefix || !key) this.throwUnauthorized();

    // 2) Get API from Mongoose/Cache
    const apiKey = await this.repo.findOneBy({ prefix: prefix });
    if (!apiKey) this.throwUnauthorized();

    // 3) Compare hash of received key with keyhash on hand
    if (!(await bcrypt.compare(key, apiKey.keyhash))) this.throwUnauthorized();

    next();
  }

  throwUnauthorized() {
    throw new HttpException("Unauthorized", HttpStatus.UNAUTHORIZED);
  }
}
