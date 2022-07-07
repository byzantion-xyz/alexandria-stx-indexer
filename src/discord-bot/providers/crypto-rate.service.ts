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

  async getNearToUSDRate() {
    const cryptoRate = await this.cryptoRateRepository.findOne({
      where: {
        fiat_currency: "USD",
        crypto_currency: "near",
      },
      select: { rate: true },
    });

    return cryptoRate.rate;
  }
}
