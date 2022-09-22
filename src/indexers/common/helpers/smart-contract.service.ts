import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SmartContract } from 'src/database/universal/entities/SmartContract';
import { Repository } from 'typeorm';

@Injectable()
export class SmartContractService {
  private basicSelect = { 
    id: true,
    contract_key: true,
    contract_key_wrapper: true,
    type: true,
    name: true
  };

  constructor (
    @InjectRepository(SmartContract)
    private smartContractRepository: Repository<SmartContract>,
  ) {}

  async findChainSmartContracts (chain_symbol: string): Promise<SmartContract[]> {
    const scs = await this.smartContractRepository.find({
      where: { chain: { symbol: chain_symbol }},
      relations: { smart_contract_functions: true, custodial_smart_contract: true },
      select: {
        ...this.basicSelect,
        custodial_smart_contract: { ...this.basicSelect },
        smart_contract_functions: true
      },
    });

    return scs;
  }

  async findByContractKey(contract_key: string, chain_symbol: string): Promise<SmartContract> {
    const sc = await this.smartContractRepository.findOne({
      where: { contract_key, chain: { symbol: chain_symbol }},
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
}
