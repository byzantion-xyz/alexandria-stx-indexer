import { Injectable } from '@nestjs/common';

@Injectable()
export class CommonUtilService {

  toSnakeCase(e: string) {
    return e.match(/([A-Z])/g).reduce(
      (str, c) => str.replace(new RegExp(c), '_' + c.toLowerCase()),
      e
    )
    .substring((e.slice(0, 1).match(/([A-Z])/g)) ? 1 : 0);
  };

  delay(ms: number) { 
    new Promise((resolve) => setTimeout(resolve, ms))
  }

  toCamelCase(e: string) {
    return e.replace(/_([a-z])/g, (g) =>  g[1].toUpperCase());
  };
}
