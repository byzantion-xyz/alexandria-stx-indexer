import { Test, TestingModule } from '@nestjs/testing';
import { SmartContractService } from './smart-contract.service';

describe('SmartContractService', () => {
  let service: SmartContractService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SmartContractService],
    }).compile();

    service = module.get<SmartContractService>(SmartContractService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
