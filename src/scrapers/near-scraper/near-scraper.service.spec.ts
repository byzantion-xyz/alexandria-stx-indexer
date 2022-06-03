import { Test, TestingModule } from '@nestjs/testing';
import { NearScraperService } from './near-scraper.service';

describe('NearScraperService', () => {
  let service: NearScraperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NearScraperService],
    }).compile();

    service = module.get<NearScraperService>(NearScraperService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
