import { Logger, Injectable } from '@nestjs/common';
import { Transaction } from '@internal/prisma/client';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class ListingTransactionService {
  private readonly logger = new Logger(ListingTransactionService.name);

  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  async process(tx: Transaction) {
    this.logger.debug(`process() ${tx.transaction.hash}`);


    this.logger.debug(`process() completed ${tx.transaction.hash}`);
  }

}
