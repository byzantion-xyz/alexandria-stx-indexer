import { HttpException, HttpStatus, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApikeyMiddleware implements NestMiddleware {

  constructor(
    private config: ConfigService
  ) {

  }
  private readonly logger = new Logger(ApikeyMiddleware.name);

  use(req: Request, res: Response, next: () => void) {
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    const apiKey = req.headers['x-api-key'];
    const secret = this.config.get('app.configureDiscordServerApiKey');

    if (!apiKey || !secret || apiKey !== secret) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);        
    }

    next();
  }
}
