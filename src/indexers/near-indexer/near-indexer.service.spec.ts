import { Test, TestingModule } from '@nestjs/testing';
import { NearIndexerService } from './near-indexer.service';

describe('NearIndexerService', () => {
  let service: NearIndexerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NearIndexerService],
    }).compile();

    service = module.get<NearIndexerService>(NearIndexerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
