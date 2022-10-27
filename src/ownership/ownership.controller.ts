import { Body, Controller, Get, HttpException, HttpStatus, Logger, Query } from '@nestjs/common';
import { WalletNft, WalletNftsResult } from './interfaces/wallet-nft.interface';
import { NearOwnershipService, NftToken } from './providers/near-ownership.service';

@Controller('ownership')
export class OwnershipController {
  private readonly logger = new Logger(OwnershipController.name);

  constructor(
    private nearOwnershipService: NearOwnershipService    
  ) { }

  @Get('differences/near-wallet')
  async getNearOwnership(@Query() params: { owner }): Promise<WalletNft[]> {
    if (!params || !params.owner) {
      throw new HttpException(`Owner is required`, HttpStatus.BAD_REQUEST);
    }
    const differences = await this.nearOwnershipService.process([params.owner]);

    return differences;
  }

  @Get('differences/near-super-users')
  async getNearSuperUsersOwnership(): Promise<WalletNft[]> {
    const differences = await this.nearOwnershipService.process();
    return differences;
  }

  @Get('differences/near-active-wallets')
  async getNearActiveWalletsOwnership(): Promise<WalletNft[]> {
    const wallets: string[] = await this.nearOwnershipService.getActiveWallets('Near');

    const differences = await this.nearOwnershipService.process(wallets);
    return differences;
  }

  @Get('wallet/nfts')
  async getNftTokensOnSmartContract(@Query() params: { owner, contract_key }): Promise<WalletNft[]> {
    if (!params || !params.contract_key || !params.owner) {
      throw new HttpException(`contract_key is required`, HttpStatus.BAD_REQUEST);
    }

    const differences = await this.nearOwnershipService.fetchSmartContractOwnedNfts(params.owner, params.contract_key);
    return differences;
  }

  @Get('nft/owner')
  async getNftOwner(@Query() params: { token_id, contract_key }): Promise<string> {
    if (!params || !params.contract_key || !params.token_id) {
      throw new HttpException(`contract_key and token_id are required`, HttpStatus.BAD_REQUEST);
    }

    const token = await this.nearOwnershipService.fetchSmartContractNft(params.contract_key, params.token_id);
    return token === null ? null : token?.owner_id;
  }

}
