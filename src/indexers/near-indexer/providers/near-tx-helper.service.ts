import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NearTxHelperService {
  private readonly logger = new Logger(NearTxHelperService.name);

  nanoToMiliSeconds(nanoseconds: bigint) {
    return Number(BigInt(nanoseconds) / BigInt(1e6));
  }

  parseBase64Arguments(args: string) {
    try {
      let json = JSON.parse(Buffer.from(args, 'base64').toString());
      if (json.msg) {
        try {
          json.msg = JSON.parse(json.msg);
        } catch (err) {}
      }
      return json;
    } catch (err) {
      this.logger.warn('parseBase64Arguments() failed. ', err);
      throw err;
    }
  }

}
