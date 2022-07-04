import { Column, Entity, Index, OneToMany } from "typeorm";
import { DiscordServerChannel } from "./DiscordServerChannel";

@Index("discord_server_pkey", ["id"], { unique: true })
@Index("discord_server_server_id_key", ["serverId"], { unique: true })
@Entity("discord_server", { schema: "public" })
export class DiscordServer {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("text", { name: "server_id" })
  serverId: string;

  @Column("text", { name: "server_name" })
  serverName: string;

  @Column("boolean", { name: "active", default: () => "false" })
  active: boolean;

  @OneToMany(
    () => DiscordServerChannel,
    (discordServerChannel) => discordServerChannel.discordServer
  )
  discordServerChannels: DiscordServerChannel[];
}
