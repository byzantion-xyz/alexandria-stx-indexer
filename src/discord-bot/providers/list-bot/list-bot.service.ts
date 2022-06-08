import { Injectable, Logger } from '@nestjs/common';
import { Once, InjectDiscordClient } from '@discord-nestjs/core';
import { Client } from 'discord.js';

@Injectable()
export class ListBotService {
    private readonly logger = new Logger(ListBotService.name);

    constructor(
        @InjectDiscordClient() private readonly client: Client,
    ) {}

}
