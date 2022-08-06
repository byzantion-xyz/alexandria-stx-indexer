import { Injectable } from '@nestjs/common';
import { ListIndexerService } from 'src/indexers/common/providers/list-indexer.service';

@Injectable()
export class RelistIndexerService extends ListIndexerService {}
