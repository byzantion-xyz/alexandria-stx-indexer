import { Injectable } from '@nestjs/common';
import { ListIndexerService } from 'src/indexers/stacks-indexer/providers/list-indexer.service';

@Injectable()
export class RelistIndexerService extends ListIndexerService {}
