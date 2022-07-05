import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { CollectionOnDiscordServerChannel } from "./CollectionOnDiscordServerChannel";
import { DiscordServer } from "./DiscordServer";

@Index("discord_server_channel_discord_server_id_channel_id_purpose_key", ["channelId", "discordServerId", "purpose"], {
  unique: true,
})
@Index("discord_server_channel_pkey", ["id"], { unique: true })
@Entity("discord_server_channel", { schema: "public" })
export class DiscordServerChannel {
  @Column("uuid", { primary: true })
  id: string;

  @Column("text")
  channel_id: string;

  @Column("text")
  name: string;

  @Column("enum", { enum: ["sales", "listings", "bids"] })
  purpose: "sales" | "listings" | "bids";

  @Column("uuid")
  discord_server_id: string;

  @OneToMany(
    () => CollectionOnDiscordServerChannel,
    (collectionOnDiscordServerChannel) => collectionOnDiscordServerChannel.discord_server_channel
  )
  collection_on_discord_server_channels: CollectionOnDiscordServerChannel[];

  @ManyToOne(() => DiscordServer, (discordServer) => discordServer.discord_server_channels, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "discord_server_id", referencedColumnName: "id" }])
  discord_server: DiscordServer;
}
