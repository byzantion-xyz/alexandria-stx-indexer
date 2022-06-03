import { Test, TestingModule } from '@nestjs/testing';
import { ListingTransactionService } from './listing-transaction.service';

describe('ListingTransactionService', () => {
  let service: ListingTransactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ListingTransactionService],
    }).compile();

    service = module.get<ListingTransactionService>(ListingTransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
