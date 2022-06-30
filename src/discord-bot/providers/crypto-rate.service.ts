import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CryptoRateService {
  private readonly logger = new Logger(CryptoRateService.name);

  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  async getNearToUSDRate() {
    const cryptoRate = await this.prismaService.crypto_rates.findUnique({
      where: {
        fiat_currency_crypto_currency: {
          fiat_currency: "USD",
          crypto_currency: "near"
        }
      },
      select: {
        rate: true
      }
    })
    return cryptoRate.rate;
  }
}
