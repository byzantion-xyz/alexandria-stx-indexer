import { Injectable, Logger } from '@nestjs/common';
import { BotHelperService } from './bot-helper.service';
import { Client } from 'pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BotNotifyService {
  private readonly logger = new Logger(BotNotifyService.name);

  constructor(
    private botHelper: BotHelperService,
    private configService: ConfigService
  ) {}

  async subscribeToActions() {
    try {
      const client = new Client(this.configService.get('DATABASE_URL'));
      client.connect();

      client.query('LISTEN new_action;', (err, res) => {
        this.logger.log('Listening DB `new_action` notifications');
      });

      client.on("notification", async (event) => {
        const actionId: string = event.payload;
        
        await this.botHelper.createAndSend(actionId);
      });
    } catch (err) {
      this.logger.warn('subscribeToActions() failed');
      this.logger.error(err);
    }
  }

}