import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { CollectionOnDiscordServerChannel } from "./CollectionOnDiscordServerChannel";
import { DiscordServer } from "./DiscordServer";

@Index(
  "discord_server_channel_discord_server_id_channel_id_purpose_key",
  ["channelId", "discordServerId", "purpose"],
  { unique: true }
)
@Index("discord_server_channel_pkey", ["id"], { unique: true })
@Entity("discord_server_channel", { schema: "public" })
export class DiscordServerChannel {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("text", { name: "channel_id" })
  channelId: string;

  @Column("text", { name: "name" })
  name: string;

  @Column("enum", { name: "purpose", enum: ["sales", "listings", "bids"] })
  purpose: "sales" | "listings" | "bids";

  @Column("uuid", { name: "discord_server_id" })
  discordServerId: string;

  @OneToMany(
    () => CollectionOnDiscordServerChannel,
    (collectionOnDiscordServerChannel) =>
      collectionOnDiscordServerChannel.discordServerChannel
  )
  collectionOnDiscordServerChannels: CollectionOnDiscordServerChannel[];

  @ManyToOne(
    () => DiscordServer,
    (discordServer) => discordServer.discordServerChannels,
    { onDelete: "RESTRICT", onUpdate: "CASCADE" }
  )
  @JoinColumn([{ name: "discord_server_id", referencedColumnName: "id" }])
  discordServer: DiscordServer;
}
