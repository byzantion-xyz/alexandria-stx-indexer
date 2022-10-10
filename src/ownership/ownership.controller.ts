import { Body, Controller, Get, HttpException, HttpStatus, Logger, Query } from '@nestjs/common';
import { WalletNft } from './interfaces/wallet-nft.interface';
import { NearOwnershipService } from './providers/near-ownership.service';

@Controller('ownership')
export class OwnershipController {
  private readonly logger = new Logger(OwnershipController.name);

  constructor(
    private nearOwnershipService: NearOwnershipService    
  ) { }

  @Get('differences-near')
  async getNearOwnership(@Query() params: { owner }): Promise<WalletNft[]> {
    if (!params || !params.owner) {
      throw new HttpException(`Owner is required`, HttpStatus.BAD_REQUEST);
    }
    const differences = await this.nearOwnershipService.processWallet(params.owner);

    return differences;
  }
}
