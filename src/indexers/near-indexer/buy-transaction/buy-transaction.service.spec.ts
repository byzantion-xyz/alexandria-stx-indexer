import { Test, TestingModule } from '@nestjs/testing';
import { BuyTransactionService } from './buy-transaction.service';

describe('BuyTransactionService', () => {
  let service: BuyTransactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BuyTransactionService],
    }).compile();

    service = module.get<BuyTransactionService>(BuyTransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
