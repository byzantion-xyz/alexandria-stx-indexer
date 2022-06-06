import { Test, TestingModule } from '@nestjs/testing';
import { TxHelperService } from './tx-helper.service';

describe('TxHelperService', () => {
  let service: TxHelperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TxHelperService],
    }).compile();

    service = module.get<TxHelperService>(TxHelperService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
