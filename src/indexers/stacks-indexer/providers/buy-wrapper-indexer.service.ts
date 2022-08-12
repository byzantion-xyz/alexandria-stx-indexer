import { Injectable } from '@nestjs/common';
import { BuyIndexerService } from './buy-indexer.service';

@Injectable()
export class BuyWrapperIndexerService extends BuyIndexerService {}
