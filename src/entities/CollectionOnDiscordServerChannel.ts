import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Collection } from "./Collection";
import { DiscordServerChannel } from "./DiscordServerChannel";

@Index(
  "collection_on_discord_server_channel_collection_id_discord__key",
  ["collectionId", "discordServerChannelId"],
  { unique: true }
)
@Entity("collection_on_discord_server_channel", { schema: "public" })
export class CollectionOnDiscordServerChannel {
  @Column("uuid", { name: "collection_id" })
  collectionId: string;

  @Column("uuid", { name: "discord_server_channel_id" })
  discordServerChannelId: string;

  @Column("timestamp without time zone", { name: "updated_at" })
  updatedAt: Date;

  @Column("timestamp without time zone", {
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @ManyToOne(
    () => Collection,
    (collection) => collection.collectionOnDiscordServerChannels,
    { onDelete: "RESTRICT", onUpdate: "CASCADE" }
  )
  @JoinColumn([{ name: "collection_id", referencedColumnName: "id" }])
  collection: Collection;

  @ManyToOne(
    () => DiscordServerChannel,
    (discordServerChannel) =>
      discordServerChannel.collectionOnDiscordServerChannels,
    { onDelete: "RESTRICT", onUpdate: "CASCADE" }
  )
  @JoinColumn([
    { name: "discord_server_channel_id", referencedColumnName: "id" },
  ])
  discordServerChannel: DiscordServerChannel;
}
