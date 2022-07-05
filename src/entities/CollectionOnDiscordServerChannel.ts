import { PrimaryColumn, Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Collection } from "./Collection";
import { DiscordServerChannel } from "./DiscordServerChannel";

@Index(
  "collection_on_discord_server_channel_collection_id_discord__key",
  ["collection_id", "discord_server_channel_id"],
  {
    unique: true,
  }
)
@Entity("collection_on_discord_server_channel", { schema: "public" })
export class CollectionOnDiscordServerChannel {
  @PrimaryColumn("uuid")
  collection_id: string;

  @PrimaryColumn("uuid")
  discord_server_channel_id: string;

  @Column("timestamp without time zone")
  updated_at: Date;

  @Column("timestamp without time zone", {
    default: () => "CURRENT_TIMESTAMP",
  })
  created_at: Date;

  @ManyToOne(() => Collection, (collection) => collection.collection_on_discord_server_channels, {
    onDelete: "RESTRICT",
    onUpdate: "CASCADE",
  })
  @JoinColumn([{ name: "collection_id", referencedColumnName: "id" }])
  collection: Collection;

  @ManyToOne(
    () => DiscordServerChannel,
    (discordServerChannel) => discordServerChannel.collection_on_discord_server_channels,
    { onDelete: "RESTRICT", onUpdate: "CASCADE" }
  )
  @JoinColumn([{ name: "discord_server_channel_id", referencedColumnName: "id" }])
  discord_server_channel: DiscordServerChannel;
}
