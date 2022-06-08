import { Test, TestingModule } from '@nestjs/testing';
import { UnlistTransactionService } from './unlist-transaction.service';

describe('UnlistTransactionService', () => {
  let service: UnlistTransactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UnlistTransactionService],
    }).compile();

    service = module.get<UnlistTransactionService>(UnlistTransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
