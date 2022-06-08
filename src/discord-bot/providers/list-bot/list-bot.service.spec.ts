import { Test, TestingModule } from '@nestjs/testing';
import { ListBotService } from './list-bot.service';

describe('ListBotService', () => {
  let service: ListBotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ListBotService],
    }).compile();

    service = module.get<ListBotService>(ListBotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
