import { Body, Controller, Get, HttpException, HttpStatus, Logger, Query } from '@nestjs/common';
import { WalletNft, WalletNftsResult } from './interfaces/wallet-nft.interface';
import { NearOwnershipService } from './providers/near-ownership.service';

@Controller('ownership')
export class OwnershipController {
  private readonly logger = new Logger(OwnershipController.name);

  constructor(
    private nearOwnershipService: NearOwnershipService    
  ) { }

  @Get('differences/near-wallet')
  async getNearOwnership(@Query() params: { owner }): Promise<WalletNftsResult> {
    if (!params || !params.owner) {
      throw new HttpException(`Owner is required`, HttpStatus.BAD_REQUEST);
    }
    const differences = await this.nearOwnershipService.processWallet(params.owner);

    return differences;
  }

  @Get('differences/near-super-users')
  async getNearSuperUsersOwnership(): Promise<WalletNftsResult[]> {
    const differences = await this.nearOwnershipService.process();
    return differences;
  }
}
