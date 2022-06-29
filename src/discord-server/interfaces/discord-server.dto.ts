import { DiscordChannelType } from "@prisma/client"
import { ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString, Length, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer'

export class CreateDiscordServer {
  @IsNotEmpty()
  @IsNumberString()
  @Length(18)
  server_id: string
  
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  server_name: string
  
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateDiscordServerChannel)
  channels: CreateDiscordServerChannel[]
}

export class CreateDiscordServerChannel {
  @IsNotEmpty()
  @IsNumberString()
  @Length(18)
  channel_id:    string 
  
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(128)
  name:          string
  
  @IsNotEmpty()
  @IsIn([DiscordChannelType.listings, DiscordChannelType.sales])
  purpose:       DiscordChannelType

  @IsNotEmpty()
  @IsArray()
  collections?:   string[]
}