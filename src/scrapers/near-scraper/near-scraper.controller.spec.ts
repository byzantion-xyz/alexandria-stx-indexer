import { Test, TestingModule } from '@nestjs/testing';
import { NearScraperController } from './near-scraper.controller';

describe('NearScraperController', () => {
  let controller: NearScraperController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NearScraperController],
    }).compile();

    controller = module.get<NearScraperController>(NearScraperController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
