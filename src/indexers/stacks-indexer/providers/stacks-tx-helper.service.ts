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
      let result: JSON;
      for (let arg of args) {
        let value;
        if (arg.hex) {
          value = cvToJSON(hexToCV(arg.hex));
          if (arg.type === 'uint') {
            value = Number(value); 
          }
          result[arg.name] = value;
        } 
      }

      return result;
    } catch (err) {
      this.logger.warn('parseHexArguments() failed. ', err);
    }
  }
}
