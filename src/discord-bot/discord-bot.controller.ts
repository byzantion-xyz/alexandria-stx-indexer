import { Injectable, Logger, Controller } from '@nestjs/common';
import { Once, InjectDiscordClient } from '@discord-nestjs/core';
import { Client } from 'discord.js';

@Controller('discord-bot')
export class DiscordBotController {
    private readonly logger = new Logger(DiscordBotController.name);

    constructor(
        @InjectDiscordClient() private readonly client: Client,
    ) {}

    @Once('ready')
    onReady() {
        this.logger.log(`Bot ${this.client.user.tag} was started!`);
    }

}
