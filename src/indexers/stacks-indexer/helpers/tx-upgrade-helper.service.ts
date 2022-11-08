import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MegapontAttribute } from "src/database/universal/entities/MegapontAttribute";
import { NftMeta } from "src/database/universal/entities/NftMeta";
import { NftMetaAttribute } from "src/database/universal/entities/NftMetaAttribute";
import { TxHelperService } from "src/indexers/common/helpers/tx-helper.service";
import { In, Repository } from "typeorm";

export const attribute_names = ["mouth", "jewellery", "head", "eyes", "ears", "body", "background"];

@Injectable()
export class TxUpgradeHelperService {
  private readonly logger = new Logger(TxUpgradeHelperService.name);

  constructor(
    private txHelper: TxHelperService,
    @InjectRepository(NftMeta)
    private nftMetaRepository: Repository<NftMeta>,
    @InjectRepository(NftMetaAttribute)
    private nftMetaAttributeRepository: Repository<NftMetaAttribute>,
    @InjectRepository(MegapontAttribute)
    private megapontAttributeRepository: Repository<MegapontAttribute>
  ) {}

  async findMetasByContractKeyWithAttr(contract_key: string, token_ids: string[]) {
    const nft_metas = await this.nftMetaRepository.find({
      where: {
        smart_contract: { contract_key },
        token_id: In(token_ids),
      },
      relations: { attributes: { megapont_attribute: true }, nft_state: true },
    });

    if (nft_metas.length === token_ids.length) {
      return nft_metas;
    }
  }

  async findMetaByContractKeyWithAttr(contract_key: string, token_id: string) {
    const nft_metas = await this.findMetasByContractKeyWithAttr(contract_key, [token_id]);

    if (nft_metas && nft_metas.length === 1) {
      return nft_metas[0];
    }
  }

  async findMetasByAssetNameWithAttr(asset_name: string, token_ids: string[]) {
    const nft_metas = await this.nftMetaRepository.find({
      where: {
        asset_name: asset_name,
        token_id: In(token_ids),
      },
      relations: { attributes: { megapont_attribute: true }, nft_state: true },
    });

    if (nft_metas.length === token_ids.length) {
      return nft_metas;
    }
  }

  async findMetaByAssetNameWithAttr(asset_name: string, token_id: string) {
    const nft_metas = await this.findMetasByAssetNameWithAttr(asset_name, [token_id]);

    if (nft_metas && nft_metas.length === 1) {
      return nft_metas[0];
    }
  }

  async upgradeMegapont(nftMeta: NftMeta, newBotMetas: NftMeta[], token_id_list: string[], name: string) {
    try {
      let newBot = {};
      if (newBotMetas && newBotMetas.length) {
        for (let attr of attribute_names) {
          Object.assign(newBot, {
            [attr]: newBotMetas.find((meta) => meta.token_id === token_id_list[attribute_names.indexOf(attr)]),
          });
        }
      }

      for (let attr_name of attribute_names) {
        let newAttr = {
          trait_type: newBot[attr_name]?.attributes[0]?.trait_type,
          value: newBot[attr_name]?.attributes[0]?.value,
          megapont_attribute: {
            trait_group: newBot[attr_name]?.attributes[0]?.trait_type ? "Component" : null,
            token_id: newBot[attr_name]?.token_id,
            sequence: newBot[attr_name]?.attributes[1]?.value,
          },
        };

        let arrayIndex = nftMeta.attributes.findIndex((i) => i.trait_type === newAttr.trait_type);

        if (newAttr.megapont_attribute?.trait_group) {
          if (arrayIndex >= 0) {
            nftMeta.attributes[arrayIndex] = this.nftMetaAttributeRepository.merge(nftMeta.attributes[arrayIndex], {
              value: newAttr.value,
            });

            if (nftMeta.attributes[arrayIndex].megapont_attribute) {
              nftMeta.attributes[arrayIndex].megapont_attribute = this.megapontAttributeRepository.merge(
                nftMeta.attributes[arrayIndex].megapont_attribute,
                {
                  trait_group: newAttr.megapont_attribute.trait_group,
                  token_id: newAttr.megapont_attribute.token_id,
                  sequence: newAttr.megapont_attribute.sequence,
                }
              );
            } else {
              nftMeta.attributes[arrayIndex].megapont_attribute = this.megapontAttributeRepository.create({
                trait_group: newAttr.megapont_attribute.trait_group,
                token_id: newAttr.megapont_attribute.token_id,
                sequence: newAttr.megapont_attribute.sequence,
              });
            }
          } else {
            nftMeta.attributes.push(
              this.nftMetaAttributeRepository.create({
                trait_type: newAttr.trait_type,
                value: newAttr.value,
                megapont_attribute: this.megapontAttributeRepository.create({
                  trait_group: newAttr.megapont_attribute.trait_group,
                  token_id: newAttr.megapont_attribute.token_id,
                  sequence: newAttr.megapont_attribute.sequence,
                }),
              })
            );
          }

          let burn =
            newBotMetas && newBotMetas.length
              ? newBotMetas.find((meta) => meta.token_id === newAttr.megapont_attribute.token_id)
              : undefined;
          if (!burn.nft_state?.burned) {
            await this.txHelper.burnMeta(burn.id);
          } else {
            this.logger.log(`Already burned name:${burn.name} id:${burn.token_id}`);
          }
        } else {
          delete nftMeta.attributes[arrayIndex];
        }
      }

      let arrayIndex = nftMeta.attributes.findIndex((i) => i.trait_type === "Trait Count");
      let newTraitCount = {
        trait_type: "Trait Count",
        value: nftMeta.attributes.length.toString(),
        rarity: 1,
        score: 1,
      };
      if (arrayIndex >= 0) {
        nftMeta.attributes[arrayIndex] = this.nftMetaAttributeRepository.merge(
          nftMeta.attributes[arrayIndex],
          newTraitCount
        );
      } else {
        nftMeta.attributes.push(this.nftMetaAttributeRepository.create(newTraitCount));
      }

      if (name) nftMeta.name = name.replace(/^"(.+(?="$))"$/, "$1");

      await this.nftMetaRepository.save(nftMeta, { transaction: true });
    } catch (err) {
      this.logger.warn("upgradeMegapont() failed. ", err);
      throw err;
    }
  }
}
