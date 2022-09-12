import { Injectable } from "@nestjs/common";

@Injectable()
export class CommonUtilService {
  toSnakeCase(e: string) {
    return e
      .match(/([A-Z])/g)
      .reduce((str, c) => str.replace(new RegExp(c), "_" + c.toLowerCase()), e)
      .substring(e.slice(0, 1).match(/([A-Z])/g) ? 1 : 0);
  }

  delay(ms: number) {
    new Promise((resolve) => setTimeout(resolve, ms));
  }

  toCamelCase(e: string) {
    return e.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  }

  toPascalCase(e: string) {
    return e.replace(/\w\S*/g, m => m.charAt(0).toUpperCase() + m.substr(1).toLowerCase());
  }

  // Finds a nested value within an array of objects, by key
  findByKey(obj: any, kee: string) {
    if (kee in obj) return obj[kee];
    for (let n of Object.values(obj)
      .filter(Boolean)
      .filter((v) => typeof v === "object")) {
      let found = this.findByKey(n, kee);
      if (found) return found;
    }
  }
}
