import { Injectable } from '@nestjs/common';

@Injectable()
export class BotHelperService {

    constructor() {}

    enrichByzLink (byzLink: string, server_name: string): string {
        return encodeURI(`${byzLink}?utm_source=byzantion_bot&utm_medium=${server_name}`);
    };

}
