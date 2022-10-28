import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { Repository } from 'typeorm';

@Injectable()
export class SmartContractService {
  private basicSelect = { 
    id: true,
    contract_key: true,
    chain_id: true,
    contract_key_wrapper: true,
    type: true,
    name: true
  };

  constructor (
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
  ) {}

  async findChainSmartContracts (chain_id: string): Promise<SmartContract[]> {
    const scs = await this.smartContractRepository.find({
      where: { chain_id },
      relations: { smart_contract_functions: true, custodial_smart_contract: true },
      select: {
        ...this.basicSelect,
        custodial_smart_contract: { ...this.basicSelect },
        smart_contract_functions: true
      },
    });

    return scs;
  }

  async findByContractKey(contract_key: string, chain_id: string): Promise<SmartContract> {
    const sc = await this.smartContractRepository.findOne({
      where: { contract_key, chain_id },
      relations: {
        smart_contract_functions: true,
        custodial_smart_contract: true
      },
      select: {
        ...this.basicSelect,
        custodial_smart_contract: { ...this.basicSelect },
        smart_contract_functions: true
      },
      cache: 60000
    });

    return sc;
  }

  async readOrFetchByKey(contractKey: string, chainId: string, marketScs?: SmartContract[]): Promise<SmartContract> {
    return Array.isArray(marketScs) && marketScs.length
      ? marketScs.find(sc => sc.contract_key === contractKey)
      : await this.smartContractRepository.findOne({ 
        where: { chain_id: chainId, contract_key: contractKey }
      });
  }
}
