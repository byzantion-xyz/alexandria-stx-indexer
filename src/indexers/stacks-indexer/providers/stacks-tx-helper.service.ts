import { Injectable, Logger } from '@nestjs/common';
import { hexToCV, cvToJSON } from '@stacks/transactions';
interface FunctionArgs {
  hex: string;
  repr: string;
  name: string;
  type: string;
}

@Injectable()
export class StacksTxHelperService {
  private readonly logger = new Logger(StacksTxHelperService.name);

  parseHexArguments(args: FunctionArgs[]) {
    try {
      let result = {};

      for (let arg of args) {
        if (arg.hex) {
          let data = cvToJSON(hexToCV(arg.hex));
          result[arg.name] = data.type === 'uint' ? Number(data.value) : data.value;
        } 
      }

      return result;
    } catch (err) {
      this.logger.warn('parseHexArguments() failed. ', err);
    }
  }
}
