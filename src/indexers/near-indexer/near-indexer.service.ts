import { Logger, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PrismaService as PrismaMongoService } from 'src/prisma.mongo.service';

@Injectable()
export class NearIndexerService {
    private readonly logger = new Logger(NearIndexerService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly prismaMongoService: PrismaMongoService
    ) {}

    async runIndexer() {
        this.logger.debug('Initialize');
    
        //const transaction = await this.prismaMongoService.transactions.findFirst();
        //this.logger.debug(transaction);

        this.logger.debug('Completed');
    }

    async fetchTransaction() {

    }

    async processTransaction() {

    }

}
