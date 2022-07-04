import { Column, Entity, Index, OneToMany } from "typeorm";
import { DiscordServerChannel } from "./DiscordServerChannel";

@Index("discord_server_pkey", ["id"], { unique: true })
@Index("discord_server_server_id_key", ["serverId"], { unique: true })
@Entity("discord_server", { schema: "public" })
export class DiscordServer {
  @Column("uuid", { primary: true })
  id: string;

  @Column("text")
  server_id: string;

  @Column("text")
  server_name: string;

  @Column("boolean", { default: () => "false" })
  active: boolean;

  @OneToMany(() => DiscordServerChannel, (discordServerChannel) => discordServerChannel.discord_server)
  discord_server_channels: DiscordServerChannel[];
}
