import { Test, TestingModule } from '@nestjs/testing';
import { NearIndexerController } from './near-indexer.controller';

describe('NearIndexerController', () => {
  let controller: NearIndexerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NearIndexerController],
    }).compile();

    controller = module.get<NearIndexerController>(NearIndexerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
