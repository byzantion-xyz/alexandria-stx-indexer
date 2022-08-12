import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CryptoRate } from "src/database/universal/entities/CryptoRate";
import { Repository } from "typeorm";

@Injectable()
export class CryptoRateService {
  private readonly logger = new Logger(CryptoRateService.name);

  constructor(
    @InjectRepository(CryptoRate)
    private cryptoRateRepository: Repository<CryptoRate>
  ) {}

  async getExchangeRate(crypto: string, fiat: string): Promise<string> {
     // Map our crypto rates currencies to chain coin
    switch (crypto) {
      case 'NEAR': crypto = 'near';
        break;
      case 'STX': crypto = 'blockstack';
        break;
    }

    const cryptoRate = await this.cryptoRateRepository.findOne({
      where: {
        fiat_currency: fiat,
        crypto_currency: crypto,
      },
      select: { rate: true },
    });

    return cryptoRate.rate;
  }

  async cryptoToFiat(price: number, crypto: string, fiat: string): Promise<number> {
    let priceInFiat;
    const rate = await this.getExchangeRate(crypto, fiat);
    if (crypto === 'NEAR') {
      if (rate) {
        priceInFiat = Number(rate) * Number(price);
        priceInFiat = Math.round((priceInFiat + Number.EPSILON) * 100) / 100;
      }
    } else if (crypto === 'STX') {
      if (rate) {
        priceInFiat = +(Number(rate) * Number(price)).toFixed(2);
      }
    }

    return priceInFiat;
  }

}
