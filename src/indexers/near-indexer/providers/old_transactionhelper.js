const tweetHelper = require('../tweetHelper');
const discordHelper = require('../discordHelper');
const Action = require('../../models/Action');
const Collection = require('../../models/Collection');
const Commission = require('../../models/Commission');
const CollectionBid = require('../../models/CollectionBid');
const Meta = require('../../models/Meta');
const { checkBnsBlock, checkAskingBlock } = require('../metaHelper');
const { hexToCV } = require('@stacks/transactions');
const { cvToTrueValue, cvToJSON } = require('micro-stacks/clarity');
const Bns = require('../../models/Bns');

const { sendBidNotifications } = require('../notificationsHelper');
const { formatSTX } = require('../../util/formatSTX');
const { getOwner } = require('../getOwner');
const { checkStakingBlock, stakeMeta, unstakeMeta, mapNftContract } = require('../stakingHelper');
const { default: axios } = require('axios');
const missingHelper = require('../missingHelper');
const {
  extractDataFromHex,
  extractContractKey,
  extractContractId,
  extractSenderAddress,
  extractSmartContractLogEvents,
  extractContractKeyFromEvent,
  extractBnsNamespace,
  extractBnsName
} = require('./txExtractionHelper');
const { sendBotsBuyNotifications } = require('../botNotificationsHelper');

const processTransfer = async (transaction) => {
  try {
    console.log('processTransfer() ', { tx_id: transaction.tx_id });
    const contract_key = transaction.contract_key.replace("'", '');

    if (
      transaction.tx.contract_call.function_args[0].type == 'uint' &&
      transaction.tx.contract_call.function_args[1].type == 'principal' &&
      transaction.tx.contract_call.function_args[2].type == 'principal'
    ) {
      const token_id = extractDataFromHex(transaction.tx, 0);
      const meta = await Meta.findOne({ contract_key, token_id });

      if (meta) {
        try {
          let action = new Action({
            marketplace_id: null,
            meta_id: meta._id,
            collection_id: meta.collection_id,
            contract_key: meta.contract_key,
            action: 'transfer',
            seller: extractDataFromHex(transaction.tx, 1),
            buyer: extractDataFromHex(transaction.tx, 2),
            block_height: transaction.tx.block_height,
            tx_index: transaction.tx.tx_index,
            burn_block_time_iso: transaction.tx.burn_block_time_iso,
            tx_id: transaction.tx_id
          });
          await action.save();
          console.log(`New Action Transfer: ${action._id}`);
        } catch (err) {
          console.error(err);
        }
        console.log('Processed: ', transaction.tx_id);
      } else {
        console.log('meta not found', { contract_key, token_id });
        console.log('Missing: ', transaction.tx_id);
      }

      return meta ? true : false;
    } else {
      console.log('-------non standard transfer--------', transaction.contract_key);
      console.log('meta not found');
      console.log('Missing: ', transaction.tx_id);
      return false;
    }
  } catch (err) {
    console.log('transfer err', err);
    console.log('Missing: ', transaction.tx_id);
    return false;
  }
};

const processBuy = async (transaction, market, reportNotifications) => {
  console.log('processBuy() ', { tx_id: transaction.tx_id });
  // Search Meta
  // If found: report notifications, save action and update meta
  try {
    const contract_key = extractContractKey(transaction, market.buy_function.contract_key);
    const token_id = extractDataFromHex(transaction.tx, market.buy_function.token_id);

    let meta = await Meta.findOne({ contract_key, token_id }).populate('collection_id');

    if (meta) {
      if (
        transaction.tx.block_height > meta.list_block_height ||
        (transaction.tx.block_height == meta.list_block_height && transaction.tx.tx_index > meta.list_tx_index) ||
        !meta.list_block_height
      ) {
        if (reportNotifications) {
          await sendBotsBuyNotifications(meta, transaction, 'buy');
        }

        let commission = await Commission.findOne({ commission_key: meta.commission_key });

        try {
          let action = new Action({
            marketplace_id: market._id,
            meta_id: meta._id,
            collection_id: meta.collection_id,
            contract_key: meta.contract_key,
            action: 'buy',
            commission: meta.commission || null,
            commission_key: meta.commission_key || null,
            market_name: commission?.market_name || null,
            list_price: meta.list_price,
            seller: meta.list_seller,
            buyer: extractSenderAddress(transaction.tx),
            block_height: transaction.tx.block_height,
            tx_index: transaction.tx.tx_index,
            burn_block_time_iso: transaction.tx.burn_block_time_iso,
            tx_id: transaction.tx_id
          });
          await action.save();
          console.log(`New Action Buy: ${action._id}`);
        } catch (err) {
          console.warn(err);
        }

        if (reportNotifications) {
          let nftPrice = Number(formatSTX(meta.list_price / 1000000)).toFixed(3);
          if (nftPrice.slice(-3) == '000') {
            nftPrice = Number(nftPrice).toFixed(0);
          }

          let notifyMetaData = {
            nftPrice: nftPrice,
            nftLink: meta.collection_id?.slug
              ? `https://byzantion.xyz/collection/${meta.collection_id.slug}/${meta.token_id}`
              : `https://byzantion.xyz/collection/${meta.contract_key}/${meta.token_id}`,
            nftName: meta?.name ? meta.name : '',
            nftCollection: meta.collection_id?.asset_name ? meta.collection_id.asset_name.replaceAll('-', ' ') : ''
          };

          await sendBidNotifications(meta.list_seller, 'sold', notifyMetaData);
        }

        meta.list_price = null;
        meta.list_seller = null;
        meta.list_block_height = transaction.tx.block_height;
        meta.list_tx_index = transaction.tx.tx_index;
        meta.collection_map_id = null;
        meta.list_contract = null;
        meta.commission = null;
        meta.commission_key = null;
        meta.listed = false;
        meta.last_update = transaction.tx.burn_block_time_iso;
        await meta.save();
        console.log('updated', meta.token_id);

        console.log('Processed: ', transaction.tx_id);
      } else {
        console.log('Too Late ---', contract_key, market.contract_key);
      }
    } else {
      if (contract_key) {
        console.log('Missing: --- ', contract_key, transaction.tx_id);
      }
    }

    return meta ? true : false;
  } catch (error) {
    console.error(error);

    return false;
  }
};

const processList = async (transaction, market, reportNotifications) => {
  console.log('processList() ', { tx_id: transaction.tx_id });

  const contract_key = extractContractKey(transaction, market.list_function.contract_key);
  const token_id = extractDataFromHex(transaction.tx, market.list_function.token_id);
  const list_price = extractDataFromHex(transaction.tx, market.list_function.list_price);

  let meta = await Meta.findOne({ contract_key, token_id }).populate('collection_id');

  if (meta) {
    const collection_map_id = extractDataFromHex(transaction.tx, market.list_function.collection_map_id);

    if (
      transaction.tx.block_height > meta.list_block_height ||
      (transaction.tx.block_height == meta.list_block_height && transaction.tx.tx_index > meta.list_tx_index) ||
      !meta.list_block_height
    ) {
      (meta.list_contract = extractContractId(transaction)),
        (meta.listed = true),
        (meta.list_price = list_price),
        (meta.collection_map_id = collection_map_id || null),
        (meta.list_seller = extractSenderAddress(transaction.tx)),
        (meta.list_block_height = transaction.tx.block_height),
        (meta.list_tx_index = transaction.tx.tx_index),
        (meta.commission = extractDataFromHex(transaction.tx, market.relist_function.commission_trait) || null);
      meta.last_update = transaction.tx.burn_block_time_iso;
      if (meta.commission) {
        meta.commission_key = meta.commission;
      } else {
        meta.commission_key = `${meta.list_contract}::${meta.contract_key}`;
      }

      await meta.save();
      console.log(`New Listing: ${meta.name} - ${transaction.tx_id}`);

      if (reportNotifications) {
        await discordHelper.discordListing(meta, transaction.tx, 'list');
      }

      let commission = await Commission.findOne({ commission_key: meta.commission_key });

      try {
        let action = new Action({
          marketplace_id: market._id,
          meta_id: meta._id,
          collection_id: meta.collection_id,
          contract_key: meta.contract_key,
          action: 'list',
          commission: meta.commission || null,
          commission_key: meta.commission_key || null,
          market_name: commission.market_name || null,
          list_price: extractDataFromHex(transaction.tx, market.list_function.list_price),
          seller: extractSenderAddress(transaction.tx),
          block_height: transaction.tx.block_height,
          tx_index: transaction.tx.tx_index,
          burn_block_time_iso: transaction.tx.burn_block_time_iso,
          tx_id: transaction.tx_id
        });

        await action.save();
        console.log(`New Action List: ${action._id}`);
      } catch (err) {
        console.warn(err);
      }

      console.log('Processed: ', transaction.tx_id);
    } else {
      console.log('Too Late ---', contract_key, market.contract_key);
    }
  } else {
    if (contract_key) {
      console.log('Missing: --- ', contract_key, transaction.tx_id);
      missingHelper.handleTransaction(transaction, market, 'list-indexer');
    }
  }

  return meta ? true : false;
};

const processUnlist = async (transaction, market) => {
  console.log('processUnlist() ', { tx_id: transaction.tx_id });

  // console.log('unlist')
  try {
    const contract_key = extractContractKey(transaction, market.unlist_function.contract_key);
    const token_id = extractDataFromHex(transaction.tx, market.unlist_function.token_id);

    let meta = await Meta.findOne({ contract_key, token_id });

    if (meta) {
      if (
        transaction.tx.block_height > meta.list_block_height ||
        (transaction.tx.block_height == meta.list_block_height && transaction.tx.tx_index > meta.list_tx_index) ||
        !meta.list_block_height
      ) {
        let commission = await Commission.findOne({ commission_key: meta.commission_key });

        try {
          let action = new Action({
            marketplace_id: market._id,
            meta_id: meta._id,
            collection_id: meta.collection_id,
            contract_key: meta.contract_key,
            action: 'unlist',
            commission: meta.commission || null,
            commission_key: meta.commission_key || null,
            market_name: commission?.market_name || null,
            list_price: meta.list_price,
            seller: meta.list_seller,
            block_height: transaction.tx.block_height,
            tx_index: transaction.tx.tx_index,
            burn_block_time_iso: transaction.tx.burn_block_time_iso,
            tx_id: transaction.tx_id
          });
          await action.save();
          console.log(`New Action Unlist: ${action._id}`);
        } catch (err) {
          console.warn(err);
        }

        meta.list_price = null;
        meta.list_seller = null;
        meta.list_block_height = transaction.tx.block_height;
        meta.list_tx_index = transaction.tx.tx_index;
        meta.collection_map_id = null;
        meta.list_contract = null;
        meta.commission = null;
        meta.commission_key = null;
        meta.listed = false;
        meta.last_update = transaction.tx.burn_block_time_iso;
        await meta.save();
        console.log('updated', meta.token_id);

        console.log('Processed: ', transaction.tx_id);
      } else {
        console.log('Too Late ---', contract_key, market.contract_key);
      }
    } else {
      if (contract_key) {
        console.log('Missing: --- ', contract_key, transaction.tx_id);
      }
    }

    return meta ? true : false;
  } catch (error) {
    console.error(error);
  }
};

const processBid = async (transaction, market, reportNotifications) => {
  console.log('processBid() ', { tx_id: transaction.tx_id });

  const contract_key = extractContractKey(transaction, market.bid_function.contract_key);
  const token_id = extractDataFromHex(transaction.tx, market.bid_function.token_id);

  let meta = await Meta.findOne({ contract_key, token_id }).populate('collection_id');

  if (meta) {
    if (
      transaction.tx.block_height > meta.bid_block_height ||
      (transaction.tx.block_height == meta.bid_block_height && transaction.tx.tx_index > meta.bid_tx_index) ||
      !meta.bid_block_height
    ) {
      const bid_price = extractDataFromHex(transaction.tx, market.bid_function.bid_price);

      meta.bid_price = bid_price;
      meta.bid_buyer = extractSenderAddress(transaction.tx);
      meta.bid_contract = extractContractId(transaction);
      meta.bid_block_height = transaction.tx.block_height;
      meta.bid_tx_index = transaction.tx.tx_index;
      meta.bid = true;
      await meta.save();
      console.log(`New Bid: ${meta.name} - ${transaction.tx_id}`);

      let action = new Action({
        marketplace_id: market._id,
        meta_id: meta._id,
        collection_id: meta.collection_id,
        contract_key: meta.contract_key,
        action: 'bid',
        bid_price: bid_price,
        buyer: extractSenderAddress(transaction.tx),
        block_height: transaction.tx.block_height,
        tx_index: transaction.tx.tx_index,
        burn_block_time_iso: transaction.tx.burn_block_time_iso,
        tx_id: transaction.tx_id
      });

      try {
        await action.save();
        console.log(`New Action Bid: ${action._id}`);
      } catch (err) {
        console.warn(err);
      }

      // FIND NFT OWNER
      const nftOwner = await getOwner(meta.contract_key.split('.')[0], meta.contract_key.split('.')[1], meta.token_id);
      let nftBid = Number(formatSTX(bid_price / 1000000)).toFixed(3);
      if (nftBid.slice(-3) == '000') {
        nftBid = Number(nftBid).toFixed(0);
      }
      let notifyMetaData = {
        nftPrice: nftBid,
        nftLink: meta.collection_id?.slug
          ? `https://byzantion.xyz/collection/${meta.collection_id.slug}/${meta.token_id}`
          : `https://byzantion.xyz/collection/${meta.contract_key}/${meta.token_id}`,
        nftName: meta?.name ? meta.name : '',
        nftCollection: meta.collection_id?.asset_name ? meta.collection_id.asset_name.replaceAll('-', ' ') : ''
      };

      if (reportNotifications) {
        await sendBidNotifications(nftOwner, 'bidded_on', notifyMetaData);
        // Send bid post to discord
        await discordHelper.bid(meta, action, 'bid');
      }
      console.log('Processed: ', transaction.tx_id);
    } else {
      console.log('Too Late Bid ---', transaction.tx_id);
    }
  } else {
    console.log('Missing Meta Bid ---', transaction.tx_id);
  }

  return meta ? true : false;
};

const processUnlistBid = async (transaction, market) => {
  console.log('processUnlistBid() ', { tx_id: transaction.tx_id });

  const contract_key = extractContractKey(transaction, market.unlist_bid_function.contract_key);
  const token_id = extractDataFromHex(transaction.tx, market.unlist_bid_function.token_id);

  let meta = await Meta.findOne({ contract_key, token_id });

  if (meta) {
    if (
      transaction.tx.block_height > meta.bid_block_height ||
      (transaction.tx.block_height == meta.bid_block_height && transaction.tx.tx_index > meta.bid_tx_index) ||
      !meta.bid_block_height
    ) {
      try {
        let action = new Action({
          marketplace_id: market._id,
          meta_id: meta._id,
          collection_id: meta.collection_id,
          contract_key: meta.contract_key,
          action: 'unlist-bid',
          bid_price: meta.bid_price,
          buyer: meta.bid_buyer,
          block_height: transaction.tx.block_height,
          tx_index: transaction.tx.tx_index,
          burn_block_time_iso: transaction.tx.burn_block_time_iso,
          tx_id: transaction.tx_id
        });
        await action.save();
        console.log(`New Action Unlist Bid: ${action._id}`);
      } catch (err) {
        console.warn(err);
      }

      meta.bid_price = null;
      meta.bid_buyer = null;
      meta.bid_contract = null;
      meta.bid_block_height = transaction.tx.block_height;
      meta.bid_tx_index = transaction.tx.tx_index;
      meta.bid = false;
      await meta.save();
      console.log(`New Unlist Bid: ${meta.name} - ${transaction.tx_id}`);

      console.log('Processed: ', transaction.tx_id);
    } else {
      console.log('Too Late Unlist Bid ---', transaction.tx_id);
    }
  } else {
    console.log('Missing Meta Unlist Bid ---', transaction.tx_id);
  }

  return meta ? true : false;
};

const processAcceptBid = async (transaction, market, reportNotifications) => {
  console.log('processAcceptBid() ', { tx_id: transaction.tx_id });

  const contract_key = extractContractKey(transaction, market.accept_bid_function.contract_key);
  const token_id = extractDataFromHex(transaction.tx, market.accept_bid_function.token_id);
  let meta = await Meta.findOne({ contract_key, token_id }).populate('collection_id');

  if (meta) {
    if (
      transaction.tx.block_height > meta.bid_block_height ||
      (transaction.tx.block_height == meta.bid_block_height && transaction.tx.tx_index > meta.bid_tx_index) ||
      !meta.bid_block_height
    ) {
      let action = new Action({
        marketplace_id: market._id,
        meta_id: meta._id,
        collection_id: meta.collection_id,
        contract_key: meta.contract_key,
        action: 'accept-bid',
        bid_price: meta.bid_price,
        buyer: meta.bid_buyer,
        seller: extractSenderAddress(transaction.tx),
        block_height: transaction.tx.block_height,
        tx_index: transaction.tx.tx_index,
        burn_block_time_iso: transaction.tx.burn_block_time_iso,
        tx_id: transaction.tx_id
      });
      await action.save().catch((err) => {});
      console.log(`New Action Accept Bid: ${action._id}`);

      let nftBid = Number(formatSTX(meta.bid_price / 1000000)).toFixed(3);
      if (nftBid.slice(-3) == '000') {
        nftBid = Number(nftBid).toFixed(0);
      }

      let notifyMetaData = {
        nftPrice: nftBid,
        nftLink: meta.collection_id?.slug
          ? `https://byzantion.xyz/collection/${meta.collection_id.slug}/${meta.token_id}`
          : `https://byzantion.xyz/collection/${meta.contract_key}/${meta.token_id}`,
        nftName: meta?.name ? meta.name : '',
        nftCollection: meta.collection_id?.asset_name ? meta.collection_id.asset_name.replaceAll('-', ' ') : ''
      };
      if (reportNotifications) {
        await sendBidNotifications(meta.bid_buyer, 'accepted_bid', notifyMetaData);
      }
      meta.bid_price = null;
      meta.bid_buyer = null;
      meta.bid_contract = null;
      meta.bid_block_height = transaction.tx.block_height;
      meta.bid_tx_index = transaction.tx.tx_index;
      meta.bid = false;
      await meta.save();
      console.log(`New Accept Bid: ${meta.name} - ${transaction.tx_id}`);

      // Send accept-bid post to discord bid channel
      if (reportNotifications) {
        await discordHelper.bid(meta, action, 'accept-bid');
      }
      console.log('Processed: ', transaction.tx_id);
    } else {
      console.log('Too Late Accept Bid ---', transaction.tx_id);
    }
  } else {
    console.log('Missing Meta Accept Bid ---', transaction.tx_id);
  }

  return meta ? true : false;
};

const processCollectionBid = async (transaction, market, reportNotifications) => {
  console.log('processCollectionBid() ', { tx_id: transaction.tx_id });

  const contract_key = extractContractKey(transaction, market.collection_bid_function.contract_key);

  const collection = await Collection.findOne({ contract_key });

  if (collection) {
    if (
      transaction.tx.block_height > collection.collection_bid_block_height ||
      (transaction.tx.block_height == collection.collection_bid_block_height &&
        transaction.tx.tx_index > collection.collection_bid_tx_index) ||
      !collection.collection_bid_block_height
    ) {
      const collection_bid_price = extractDataFromHex(transaction.tx, market.collection_bid_function.bid_price);
      collection.collection_bid_price = collection_bid_price;

      collection.collection_bid_buyer = extractSenderAddress(transaction.tx);
      collection.collection_bid_contract = extractContractId(transaction);
      collection.collection_bid_block_height = transaction.tx.block_height;
      collection.collection_bid_tx_index = transaction.tx.tx_index;
      collection.collection_bid = true;
      collection.collection_bid_micro = transaction.tx.microblock_sequence;
      await collection.save();
      console.log(`New Collection Bid: ${collection.contract_key} - ${transaction.tx_id}`);

      let action = new Action({
        marketplace_id: market._id,
        collection_id: collection._id,
        contract_key: collection.contract_key,
        action: 'collection-bid',
        bid_price: collection_bid_price,
        buyer: extractSenderAddress(transaction.tx),
        block_height: transaction.tx.block_height,
        tx_index: transaction.tx.tx_index,
        burn_block_time_iso: transaction.tx.burn_block_time_iso,
        tx_id: transaction.tx_id
      });

      try {
        await action.save();
        console.log(`New Action Collection Bid: ${action._id}`);
      } catch (err) {
        console.warn(err);
      }

      console.log('Processed: ', transaction.tx_id);

      // Send collection-bid post to discord
      if (reportNotifications) {
        discordHelper.collectionBid(collection, action, 'collection-bid');
      }
    } else {
      console.log('Too Late Bid ---', transaction.tx_id);
    }
  } else {
    console.log('Missing Meta Bid ---', transaction.tx_id);
  }

  return collection ? true : false;
};

const processCollectionUnlistBid = async (transaction, market) => {
  console.log('processCollectionUnlistBid() ', { tx_id: transaction.tx_id });

  const contract_key = extractContractKey(transaction, market.collection_unlist_bid_function.contract_key);

  let collection = await Collection.findOne({ contract_key });

  if (collection) {
    if (
      transaction.tx.block_height > collection.collection_bid_block_height ||
      (transaction.tx.block_height == collection.collection_bid_block_height &&
        transaction.tx.tx_index > collection.collection_bid_tx_index) ||
      !collection.collection_bid_block_height
    ) {
      try {
        let action = new Action({
          marketplace_id: market._id,
          collection_id: collection._id,
          contract_key: collection.contract_key,
          action: 'unlist-collection-bid',
          buyer: extractSenderAddress(transaction.tx),
          block_height: transaction.tx.block_height,
          tx_index: transaction.tx.tx_index,
          burn_block_time_iso: transaction.tx.burn_block_time_iso,
          tx_id: transaction.tx_id
        });
        await action.save();
        console.log(`New Action Unlist Bid: ${action._id}`);
      } catch (err) {
        console.warn(err);
      }

      collection.collection_bid_price = null;
      collection.collection_bid_buyer = null;
      collection.collection_bid_contract = null;
      collection.collection_bid_block_height = transaction.tx.block_height;
      collection.collection_bid_tx_index = transaction.tx.tx_index;
      collection.collection_bid = false;
      await collection.save();
      console.log(`New Unlist Bid: ${collection.contract_key} - ${transaction.tx_id}`);

      console.log('Processed: ', transaction.tx_id);
    } else {
      console.log('Too Late Unlist Bid ---', transaction.tx_id);
    }
  } else {
    console.log('Missing Meta Unlist Bid ---', transaction.tx_id);
  }

  return collection ? true : false;
};

const processCollectionAcceptBid = async (transaction, market, reportNotifications) => {
  console.log('processCollectionAcceptBid() ', { tx_id: transaction.tx_id });

  const contract_key = extractContractKey(transaction, market.collection_accept_bid_function.contract_key);
  const token_id = extractDataFromHex(transaction.tx, market.collection_accept_bid_function.token_id);

  let collection = await Collection.findOne({ contract_key });
  let meta = await Meta.findOne({ contract_key, token_id });

  if (collection) {
    if (
      transaction.tx.block_height > collection.collection_bid_block_height ||
      (transaction.tx.block_height == collection.collection_bid_block_height &&
        transaction.tx.tx_index > collection.collection_bid_tx_index) ||
      !collection.collection_bid_block_height
    ) {
      let action = new Action({
        marketplace_id: market._id,
        collection_id: collection._id,
        meta_id: meta._id,
        contract_key: collection.contract_key,
        action: 'accept-bid',
        bid_price: collection.collection_bid_price,
        seller: extractSenderAddress(transaction.tx),
        buyer: collection.collection_bid_buyer,
        block_height: transaction.tx.block_height,
        tx_index: transaction.tx.tx_index,
        burn_block_time_iso: transaction.tx.burn_block_time_iso,
        tx_id: transaction.tx_id
      });

      try {
        await action.save();
        console.log(`New Action Accept Bid: ${action._id}`);
      } catch (err) {
        console.warn(err);
      }

      let nftBid = Number(formatSTX(collection.collection_bid_price / 1000000)).toFixed(3);
      if (nftBid.slice(-3) == '000') {
        nftBid = Number(nftBid).toFixed(0);
      }

      let notifyMetaData = {
        nftPrice: nftBid,
        nftLink: meta.collection_id?.slug
          ? `https://byzantion.xyz/collection/${meta.collection_id.slug}/${meta.token_id}`
          : `https://byzantion.xyz/collection/${meta.contract_key}/${meta.token_id}`,
        nftName: meta?.name ? meta.name : '',
        nftCollection: meta.collection_id?.asset_name ? meta.collection_id.asset_name.replaceAll('-', ' ') : ''
      };
      if (reportNotifications) {
        await sendBidNotifications(collection.collection_bid_buyer, 'accepted_bid', notifyMetaData);
      }
      collection.collection_bid_price = null;
      collection.collection_bid_buyer = null;
      collection.collection_bid_contract = null;
      collection.collection_bid_block_height = transaction.tx.block_height;
      collection.collection_bid_tx_index = transaction.tx.tx_index;
      collection.collection_bid = false;
      await collection.save();
      console.log(`New Collection Accept Bid: ${collection.contract_key} - ${transaction.tx_id}`);

      if (reportNotifications) {
        discordHelper.collectionBid(collection, action, 'collection-accept-bid');
      }
      console.log('Processed: ', transaction.tx_id);
    } else {
      console.log('Too Late Accept Bid ---', transaction.tx_id);
    }
  } else {
    console.log('Missing Meta Accept Bid ---', transaction.tx_id);
  }

  return collection ? true : false;
};

const processRelist = async (transaction, market, reportNotifications) => {
  console.log('processRelist() ', { tx_id: transaction.tx_id });

  const contract_key = extractContractKey(transaction, market.relist_function.contract_key);
  const token_id = extractDataFromHex(transaction.tx, market.relist_function.token_id);
  const list_price = extractDataFromHex(transaction.tx, market.relist_function.list_price);

  let meta = await Meta.findOne({ contract_key, token_id }).populate('collection_id');

  if (meta) {
    const collection_map_id = extractDataFromHex(transaction.tx, market.relist_function.collection_map_id);

    if (
      transaction.tx.block_height > meta.list_block_height ||
      (transaction.tx.block_height == meta.list_block_height && transaction.tx.tx_index > meta.list_tx_index) ||
      !meta.list_block_height
    ) {
      
      (meta.list_contract = extractContractId(transaction)),
        (meta.listed = true),
        (meta.list_price = list_price),
        (meta.collection_map_id = collection_map_id || null),
        (meta.list_seller = extractSenderAddress(transaction.tx)),
        (meta.list_block_height = transaction.tx.block_height),
        (meta.list_tx_index = transaction.tx.tx_index),
        (meta.commission = extractDataFromHex(transaction.tx, market.relist_function.commission_trait) || null);
      meta.last_update = transaction.tx.burn_block_time_iso;
      if (meta.commission) {
        meta.commission_key = meta.commission;
      } else {
        meta.commission_key = `${meta.list_contract}::${meta.contract_key}`;
      }

      await meta.save();
      console.log(`New Listing: ${meta.name} - ${transaction.tx_id}`);

      if (reportNotifications) {
        await discordHelper.discordListing(meta, transaction.tx, 'relist');
      }

      let commission = await Commission.findOne({ commission_key: meta.commission_key });

      try {
        let action = new Action({
          marketplace_id: market._id,
          meta_id: meta._id,
          collection_id: meta.collection_id,
          contract_key: meta.contract_key,
          action: 'relist',
          commission: meta.commission || null,
          commission_key: meta.commission_key || null,
          market_name: commission.market_name,
          list_price: list_price,
          seller: extractSenderAddress(transaction.tx),
          block_height: transaction.tx.block_height,
          tx_index: transaction.tx.tx_index,
          burn_block_time_iso: transaction.tx.burn_block_time_iso,
          tx_id: transaction.tx_id
        });
        await action.save();
        console.log(`New Action List: ${action._id}`);
      } catch (err) {
        console.warn(err);
      }

      console.log('Processed: ', transaction.tx_id);
    } else {
      console.log('Too Late ---', contract_key, market.contract_key);
    }
  } else {
    if (contract_key) {
      console.log('Missing: --- ', contract_key, transaction.tx_id);
    }
  }

  return meta ? true : false;
};

const processBnsRegister = async (transaction) => {
  console.log('processBnsRegister() ', { tx_id: transaction.tx_id });

  //console.log(transaction.tx_id)
  try {
    // console.log(`
    //   namespace: ${hexToCV(transaction.tx.contract_call.function_args[0].hex).buffer.toString()}
    //   name: ${ hexToCV(transaction.tx.contract_call.function_args[1].hex).buffer.toString()}
    // `)
    //console.log(transaction.tx.block_height.toString(), transaction.tx.tx_index.toString())
    let bns_found = await Meta.findOne({
      contract_key: 'SP000000000000000000002Q6VF78.bns',
      bns: `${hexToCV(transaction.tx.contract_call.function_args[1].hex).buffer.toString()}.${hexToCV(
        transaction.tx.contract_call.function_args[0].hex
      ).buffer.toString()}`
    });

    if (!bns_found) {
      let bns = new Meta({
        collection_id: '61fedb0e3ce38a3b577fca5e',
        contract_key: 'SP000000000000000000002Q6VF78.bns',
        name: hexToCV(transaction.tx.contract_call.function_args[1].hex).buffer.toString(),
        namespace: hexToCV(transaction.tx.contract_call.function_args[0].hex).buffer.toString(),
        bns: `${hexToCV(transaction.tx.contract_call.function_args[1].hex).buffer.toString()}.${hexToCV(
          transaction.tx.contract_call.function_args[0].hex
        ).buffer.toString()}`,
        token_id: Number(transaction.tx.block_height.toString() + transaction.tx.tx_index.toString()),
        slug: 'bns',
        asset_name: 'names',
        minted: true,
        image: 'https://byzantion.mypinata.cloud/ipfs/QmVbJqPStxPkpUgCcPBQE1V1SRehceTFjVSzofKp9yUC1x'
      });
      await bns.save();
      console.log(bns.bns);
    }
  } catch (error) {
    console.error(error);
  }

  return true;
};

const findBnsMeta = async (transaction, market_function) => {
  return await Meta.findOne({
    name: extractBnsName(transaction, market_function),
    namespace: extractBnsNamespace(transaction, market_function)
  });
};

const processBnsBid = async (transaction, market) => {
  console.log('processBnsBid() ', { tx_id: transaction.tx_id });

  try {
    let bns = await findBnsMeta(transaction, market.bns_bid_function);

    if (bns && checkBnsBlock(transaction, bns)) {
      const bid_price = extractDataFromHex(transaction.tx, market.bns_bid_function.bid_price);
      bns.bid_price = bid_price;
      bns.bid_buyer = extractSenderAddress(transaction.tx);
      bns.bid_contract = extractContractId(transaction);
      bns.bid_block_height = transaction.tx.block_height;
      bns.bid_tx_index = transaction.tx.tx_index;
      bns.bid = true;
      await bns.save();
      console.log(`New Bns Bid: ${bns.name} - ${transaction.tx_id}`);

      try {
        let action = new Action({
          marketplace_id: market._id,
          meta_id: bns._id,
          collection_id: bns.collection_id,
          contract_key: bns.contract_key,
          action: 'bid',
          bid_price: bid_price,
          buyer: extractSenderAddress(transaction.tx),
          block_height: transaction.tx.block_height,
          tx_index: transaction.tx.tx_index,
          burn_block_time_iso: transaction.tx.burn_block_time_iso,
          tx_id: transaction.tx_id
        });

        await action.save();
        console.log(`New Action Bid: ${action._id}`);
      } catch (err) {
        console.warn(err);
      }

      console.log('Processed: ', transaction.tx_id);
    } else if (bns) {
      console.log('Too Late Bid ---', transaction.tx_id);
    } else {
      console.log('Missing bns Bid ---', transaction.tx_id);
    }

    return bns ? true : false;
  } catch (err) {
    console.error(`processBnsBid() errored for: ${transaction.tx_id} `, err);
    return false;
  }
};

const processBnsAcceptBid = async (transaction, market) => {
  console.log('processBnsAcceptBid() ', { tx_id: transaction.tx_id });

  try {
    let bns = await findBnsMeta(transaction, market.bns_bid_function);
    console.log(bns);

    if (bns && checkBnsBlock(transaction, bns)) {
      try {
        let action = new Action({
          marketplace_id: market._id,
          meta_id: bns._id,
          collection_id: bns.collection_id,
          contract_key: bns.contract_key,
          action: 'accept-bid',
          bid_price: bns.bid_price,
          buyer: bns.bid_buyer,
          seller: extractSenderAddress(transaction.tx),
          block_height: transaction.tx.block_height,
          tx_index: transaction.tx.tx_index,
          burn_block_time_iso: transaction.tx.burn_block_time_iso,
          tx_id: transaction.tx_id
        });
        await action.save();
        console.log(`New Action Accept Bid: ${action._id}`);
      } catch (err) {
        console.warn(err);
      }

      bns.bid_price = null;
      bns.bid_buyer = null;
      bns.bid_contract = null;
      bns.bid_block_height = transaction.tx.block_height;
      bns.bid_tx_index = transaction.tx.tx_index;
      bns.bid = false;
      await bns.save();
      console.log(`New Accept Bid: ${bns.name} - ${transaction.tx_id}`);

      console.log('Processed: ', transaction.tx_id);
    } else if (bns) {
      console.log('Too Late Accept Bid ---', transaction.tx_id);
    } else {
      console.log('Missing bns Accept Bid ---', transaction.tx_id);
    }

    return bns ? true : false;
  } catch (err) {
    console.error(`processBnsAcceptBid() errored for: ${transaction.tx_id} `, err);
    return false;
  }
};

const processBnsUnlistBid = async (transaction, market) => {
  console.log('processBnsUnlistBid() ', { tx_id: transaction.tx_id });

  let bns = await findBnsMeta(transaction, market.bns_bid_function);
  console.log(bns);

  if (bns && checkBnsBlock(transaction, bns)) {
    let action = new Action({
      marketplace_id: market._id,
      meta_id: bns._id,
      collection_id: bns.collection_id,
      contract_key: bns.contract_key,
      action: 'unlist-bid',
      bid_price: bns.bid_price,
      buyer: bns.bid_buyer,
      block_height: transaction.tx.block_height,
      tx_index: transaction.tx.tx_index,
      burn_block_time_iso: transaction.tx.burn_block_time_iso,
      tx_id: transaction.tx_id
    });
    await action.save().catch((err) => {});
    console.log(`New Action Unlist Bid: ${action._id}`);

    bns.bid_price = null;
    bns.bid_buyer = null;
    bns.bid_contract = null;
    bns.bid_block_height = transaction.tx.block_height;
    bns.bid_tx_index = transaction.tx.tx_index;
    bns.bid = false;
    await bns.save();
    console.log(`New Unlist Bns Bid: ${bns.name} - ${transaction.tx_id}`);

    console.log('Processed: ', transaction.tx_id);
  } else if (bns) {
    console.log('Too Late Unlist Bid ---', transaction.tx_id);
  } else {
    console.log('Missing Meta Unlist Bid ---', transaction.tx_id);
  }

  return bns ? true : false;
};

const processBnsAsk = async (transaction, market) => {
  console.log('processBnsAsk() ', { tx_id: transaction.tx_id });

  console.log(transaction?.tx?.contract_call?.function_name, market?.bns_ask_function);

  let bns = await findBnsMeta(transaction, market.bns_ask_function);

  //console.log(bns)
  if (bns && checkAskingBlock(transaction, bns)) {
    bns.asking_price = extractDataFromHex(transaction.tx, market.bns_ask_function.asking_price);
    bns.asking_seller = extractSenderAddress(transaction.tx);
    bns.asking_block_height = transaction.tx.block_height;
    bns.asking_tx_index = transaction.tx.tx_index;
    bns.asking = true;
    bns.listed = true;
    await bns.save();
    console.log(`New Asking Price: ${bns.name} - ${transaction.tx_id}`);

    try {
      let action = new Action({
        marketplace_id: market._id,
        meta_id: bns._id,
        collection_id: bns.collection_id,
        contract_key: bns.contract_key,
        action: 'asking_price',
        asking_price: bns.asking_price,
        asker: extractSenderAddress(transaction.tx),
        block_height: transaction.tx.block_height,
        tx_index: transaction.tx.tx_index,
        burn_block_time_iso: transaction.tx.burn_block_time_iso,
        tx_id: transaction.tx_id
      });

      await action.save();
      console.log(`New Action asking-price: ${action._id}`);
    } catch (err) {
      console.warn(err);
    }

    console.log('Processed: ', transaction.tx_id);
  } else if (bns) {
    console.log('Too Late Bid ---', transaction.tx_id);
  } else {
    console.log('Missing bns Bid ---', transaction.tx_id);
  }

  return bns ? true : false;
};

const processBnsRemoveAsk = async (transaction, market) => {
  console.log('processBnsRemoveAsk() ', { tx_id: transaction.tx_id });

  let bns = await findBnsMeta(transaction, market.bns_ask_function);

  if (bns && checkAskingBlock(transaction, bns)) {
    bns.asking_price = null;
    bns.asking_seller = null;
    bns.asking_block_height = transaction.tx.block_height;
    bns.asking_tx_index = transaction.tx.tx_index;
    bns.asking = false;
    bns.listed = false;
    await bns.save();
    console.log(`New  Remove Asking Price: ${bns.name} - ${transaction.tx_id}`);

    try {
      let action = new Action({
        marketplace_id: market._id,
        meta_id: bns._id,
        collection_id: bns.collection_id,
        contract_key: bns.contract_key,
        action: 'remove_asking_price',
        asker: extractSenderAddress(transaction.tx),
        block_height: transaction.tx.block_height,
        tx_index: transaction.tx.tx_index,
        burn_block_time_iso: transaction.tx.burn_block_time_iso,
        tx_id: transaction.tx_id
      });

      await action.save();
      console.log(`New Action asking-price: ${action._id}`);
    } catch (err) {
      console.warn(err);
    }

    console.log('Processed: ', transaction.tx_id);
  } else if (bns) {
    console.log('Too Late Bid ---', transaction.tx_id);
  } else {
    console.log('Missing bns Bid ---', transaction.tx_id);
  }

  return bns ? true : false;
};

const processStake = async (transaction, market) => {
  console.log('processStake() ', { tx_id: transaction.tx_id });

  const token_id = extractDataFromHex(transaction.tx, market.stake_function.token_id);
  const contract_key = mapNftContract(market.contract_key);

  if (!contract_key) {
    console.log('Missing nft, staking contract not indexed ---', transaction.tx_id, market.contract_key);
  }

  // find nft token being staked
  let meta = await Meta.findOne({ contract_key, token_id });

  if (meta && checkStakingBlock(transaction, meta)) {
    meta = await stakeMeta(transaction, meta, market);
    console.log('Processed: ', transaction.tx_id);
    return true;
  } else {
    console.log('Missing nft ---', transaction.tx_id);
    return false;
  }
};

const processUnstake = async (transaction, market) => {
  console.log('processUnstake() ', { tx_id: transaction.tx_id });
  const token_id = extractDataFromHex(transaction.tx, market.unstake_function.token_id);
  const contract_key = mapNftContract(market.contract_key);

  if (!contract_key) {
    console.log('Missing nft, staking contract not indexed ---', transaction.tx_id, market.contract_key);
  }

  // find nft token being staked
  let meta = await Meta.findOne({ contract_key, token_id });

  if (meta && checkStakingBlock(transaction, meta)) {
    meta = await unstakeMeta(transaction, meta, market);
    console.log('Processed: ', transaction.tx_id);
    return true;
  } else {
    console.log('Missing nft ---', transaction.tx_id);
    return false;
  }
};

const processUpgrade = async (transaction, market) => {
  console.log('processUpgrade() ', { tx_id: transaction.tx_id });

  //console.log(transaction.tx.contract_call.function_args)
  try {
    let meta = await Meta.findOne({
      contract_key: market.contract_key,
      token_id: extractDataFromHex(transaction.tx, market.upgrade_function.token_id)
    });

    const market_contract_key = market.upgrade_function.ref_contract_key;

    let newBot = {
      mouth: await Meta.findOne({
        contract_key: market_contract_key,
        token_id: extractDataFromHex(transaction.tx, market.upgrade_function.mouth)
      }),
      jewellery: await Meta.findOne({
        contract_key: market_contract_key,
        token_id: extractDataFromHex(transaction.tx, market.upgrade_function.jewellery)
      }),
      head: await Meta.findOne({
        contract_key: market_contract_key,
        token_id: extractDataFromHex(transaction.tx, market.upgrade_function.head)
      }),
      eyes: await Meta.findOne({
        contract_key: market_contract_key,
        token_id: extractDataFromHex(transaction.tx, market.upgrade_function.eyes)
      }),
      ears: await Meta.findOne({
        contract_key: market_contract_key,
        token_id: extractDataFromHex(transaction.tx, market.upgrade_function.ears)
      }),
      body: await Meta.findOne({
        contract_key: market_contract_key,
        token_id: extractDataFromHex(transaction.tx, market.upgrade_function.body)
      }),
      background: await Meta.findOne({
        contract_key: market_contract_key,
        token_id: extractDataFromHex(transaction.tx, market.upgrade_function.background)
      }),
      name: extractDataFromHex(transaction.tx, market.upgrade_function.name)
    };

    let testing = [
      {
        trait_type: newBot.mouth?.attributes[0].trait_type,
        trait_group: newBot.mouth?.attributes[0].trait_type ? 'Component' : null,
        value: newBot.mouth?.attributes[0].value,
        id: newBot.mouth?.token_id,
        sequence: newBot.mouth?.attributes[1].value,
        scanned: false
      },
      {
        trait_type: newBot.jewellery?.attributes[0].trait_type,
        trait_group: newBot.jewellery?.attributes[0].trait_type ? 'Component' : null,
        value: newBot.jewellery?.attributes[0].value,
        id: newBot.jewellery?.token_id,
        sequence: newBot.jewellery?.attributes[1].value,
        scanned: false
      },
      {
        trait_type: newBot.head?.attributes[0].trait_type,
        trait_group: newBot.head?.attributes[0].trait_type ? 'Component' : null,
        value: newBot.head?.attributes[0].value,
        id: newBot.head?.token_id,
        sequence: newBot.head?.attributes[1].value,
        scanned: false
      },
      {
        trait_type: newBot.eyes?.attributes[0].trait_type,
        trait_group: newBot.eyes?.attributes[0].trait_type ? 'Component' : null,
        value: newBot.eyes?.attributes[0].value,
        id: newBot.eyes?.token_id,
        sequence: newBot.eyes?.attributes[1].value,
        scanned: false
      },
      {
        trait_type: newBot.ears?.attributes[0].trait_type,
        trait_group: newBot.ears?.attributes[0].trait_type ? 'Component' : null,
        value: newBot.ears?.attributes[0].value,
        id: newBot.ears?.token_id,
        sequence: newBot.ears?.attributes[1].value,
        scanned: false
      },
      {
        trait_type: newBot.body?.attributes[0].trait_type,
        trait_group: newBot.body?.attributes[0].trait_type ? 'Component' : null,
        value: newBot.body?.attributes[0].value,
        id: newBot.body?.token_id,
        sequence: newBot.body?.attributes[1].value,
        scanned: false
      },
      {
        trait_type: newBot.background?.attributes[0].trait_type,
        trait_group: newBot.background?.attributes[0].trait_type ? 'Component' : null,
        value: newBot.background?.attributes[0].value,
        id: newBot.background?.token_id,
        sequence: newBot.background?.attributes[1].value,
        scanned: false
      }
    ];

    meta.attributes = meta.attributes.filter((i) => {
      if (i.trait_group) {
        return false;
      } else if (i.trait_type == 'Trait Count') {
        return false;
      } else return true;
    });

    for (let a of testing) {
      if (a.scanned == false && a.trait_group) {
        meta.attributes = [...meta.attributes, a];
        let burn = await Meta.findOne({
          contract_key: market_contract_key,
          token_id: a.id
        });
        if (burn.burned != true) {
          burn.burned = true;
          await burn.save().then((b) => console.log('Burning: ', b.name, b.token_id));
        } else {
          console.log('Already burned: ', burn.name, burn.token_id);
        }
      }
    }
    meta.attributes.push({
      trait_type: 'Trait Count',
      value: meta.attributes.length.toString(),
      rarity: 1,
      score: 1
    });
    if (newBot.name) {
      meta.name = newBot.name.replace(/^"(.+(?="$))"$/, '$1');
    }
    await meta.save().then((name) => console.log(`Upgraded ${name.name}`));
    console.log('Processed: ', transaction.tx_id);

    // try {
    //   const updateBot = await updateBots(transaction.tx_id)
    //   if(updateBot){
    //     console.log('Updated Bot: ', updateBot)
    //   }
    // } catch (error) {
    //   console.error(error)
    // }
    return true;
  } catch (error) {
    console.error(error);
  }
};

const processUpgradeMega = async (transaction, market) => {
  console.log('processUpgradeMega() ', { tx_id: transaction.tx_id });
  //console.log(transaction.tx.contract_call.function_args);
  try {
    let meta = await Meta.findOne({
      asset_name: market.upgrade_mega_function.robot_asset_name,
      token_id: extractDataFromHex(transaction.tx, market.upgrade_mega_function.token_id)
    });

    let newBot = {
      mouth: await Meta.findOne({
        asset_name: market.upgrade_mega_function.component_asset_name,
        token_id: extractDataFromHex(transaction.tx, market.upgrade_mega_function.mouth)
      }),
      jewellery: await Meta.findOne({
        asset_name: market.upgrade_mega_function.component_asset_name,
        token_id: extractDataFromHex(transaction.tx, market.upgrade_mega_function.jewellery)
      }),
      head: await Meta.findOne({
        asset_name: market.upgrade_mega_function.component_asset_name,
        token_id: extractDataFromHex(transaction.tx, market.upgrade_mega_function.head)
      }),
      eyes: await Meta.findOne({
        asset_name: market.upgrade_mega_function.component_asset_name,
        token_id: extractDataFromHex(transaction.tx, market.upgrade_mega_function.eyes)
      }),
      ears: await Meta.findOne({
        asset_name: market.upgrade_mega_function.component_asset_name,
        token_id: extractDataFromHex(transaction.tx, market.upgrade_mega_function.ears)
      }),
      body: await Meta.findOne({
        asset_name: market.upgrade_mega_function.component_asset_name,
        token_id: extractDataFromHex(transaction.tx, market.upgrade_mega_function.body)
      }),
      background: await Meta.findOne({
        asset_name: market.upgrade_mega_function.component_asset_name,
        token_id: extractDataFromHex(transaction.tx, market.upgrade_mega_function.background)
      }),
      name: extractDataFromHex(transaction.tx, market.upgrade_mega_function.name)
    };

    let testing = [
      {
        trait_type: newBot.mouth?.attributes[0].trait_type,
        trait_group: newBot.mouth?.attributes[0].trait_type ? 'Component' : null,
        value: newBot.mouth?.attributes[0].value,
        id: newBot.mouth?.token_id,
        sequence: newBot.mouth?.attributes[1].value,
        scanned: false
      },
      {
        trait_type: newBot.jewellery?.attributes[0].trait_type,
        trait_group: newBot.jewellery?.attributes[0].trait_type ? 'Component' : null,
        value: newBot.jewellery?.attributes[0].value,
        id: newBot.jewellery?.token_id,
        sequence: newBot.jewellery?.attributes[1].value,
        scanned: false
      },
      {
        trait_type: newBot.head?.attributes[0].trait_type,
        trait_group: newBot.head?.attributes[0].trait_type ? 'Component' : null,
        value: newBot.head?.attributes[0].value,
        id: newBot.head?.token_id,
        sequence: newBot.head?.attributes[1].value,
        scanned: false
      },
      {
        trait_type: newBot.eyes?.attributes[0].trait_type,
        trait_group: newBot.eyes?.attributes[0].trait_type ? 'Component' : null,
        value: newBot.eyes?.attributes[0].value,
        id: newBot.eyes?.token_id,
        sequence: newBot.eyes?.attributes[1].value,
        scanned: false
      },
      {
        trait_type: newBot.ears?.attributes[0].trait_type,
        trait_group: newBot.ears?.attributes[0].trait_type ? 'Component' : null,
        value: newBot.ears?.attributes[0].value,
        id: newBot.ears?.token_id,
        sequence: newBot.ears?.attributes[1].value,
        scanned: false
      },
      {
        trait_type: newBot.body?.attributes[0].trait_type,
        trait_group: newBot.body?.attributes[0].trait_type ? 'Component' : null,
        value: newBot.body?.attributes[0].value,
        id: newBot.body?.token_id,
        sequence: newBot.body?.attributes[1].value,
        scanned: false
      },
      {
        trait_type: newBot.background?.attributes[0].trait_type,
        trait_group: newBot.background?.attributes[0].trait_type ? 'Component' : null,
        value: newBot.background?.attributes[0].value,
        id: newBot.background?.token_id,
        sequence: newBot.background?.attributes[1].value,
        scanned: false
      }
    ];

    meta.attributes = meta.attributes.filter((i) => {
      if (i.trait_group) {
        return false;
      } else if (i.trait_type == 'Trait Count') {
        return false;
      } else return true;
    });

    for (let a of testing) {
      if (a.scanned == false && a.trait_group) {
        meta.attributes = [...meta.attributes, a];
        let burn = await Meta.findOne({
          asset_name: market.upgrade_mega_function.component_asset_name,
          token_id: a.id
        });
        if (burn.burned != true) {
          burn.burned = true;
          await burn.save().then((b) => console.log('Burning: ', b.name, b.token_id));
        } else {
          console.log('Already burned: ', burn.name, burn.token_id);
        }
      }
    }
    meta.attributes.push({
      trait_type: 'Trait Count',
      value: meta.attributes.length.toString(),
      rarity: 1,
      score: 1
    });
    if (newBot.name) {
      meta.name = newBot.name.replace(/^"(.+(?="$))"$/, '$1');
    }
    await meta.save();
    //.then((name) => console.log(`Upgraded ${name.name}`));
    console.log('Processed: ', transaction.tx_id);
    // try {
    //   const updateBot = await updateBots(transaction.tx_id)
    //   if(updateBot){
    //     console.log('Updated Bot: ', updateBot)
    //   }
    // } catch (error) {
    //   console.error(error)
    // }

    return true;
  } catch (error) {
    console.error(error);
  }
};

const processRename = async (transaction, market) => {
  console.log('processRename() ', { tx_id: transaction.tx_id });

  try {
    const meta = await Meta.findOne({
      contract_key: 'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.bitcoin-monkeys',
      token_id: extractDataFromHex(transaction.tx, market.rename_function.token_id)
    });

    if (meta) {
      let new_name = extractDataFromHex(transaction.tx, market.rename_function.name)
        .replace('"', '') // Not necessary from hex. Maintained for testing
        .replace('"', ''); // Not necessary from hex. Maintained for testing

      meta.name = `#${meta.token_id} - ${new_name}`;
      meta.save();

      console.log('Processed: ', transaction.tx_id);
    } else {
      console.log('Too late Name', transaction.tx_id);
    }
    return true;
  } catch (error) {
    console.log('Missing Rename', transaction.tx_id);
    console.error(error);

    return false;
  }
};

const processChangePriceSTXNFT = async (transaction, market, reportNotifications) => {
  console.log('processChangePriceSTXNFT() ', { tx_id: transaction.tx_id });

  console.log(market.change_price_stxnft.function_name);
  //const first_market = extractDataFromHex(transaction.tx, market.change_price_stxnft.first_market);
  const second_market = extractDataFromHex(transaction.tx, market.change_price_stxnft.second_market);
  const contract_key = extractContractKey(transaction, market.change_price_stxnft.contract_key);
  const token_id = extractDataFromHex(transaction.tx, market.change_price_stxnft.token_id);
  const price = extractDataFromHex(transaction.tx, market.change_price_stxnft.price);
  const collection_map_id = extractDataFromHex(transaction.tx, market[marketFunctionName].collection_map_id);

  let meta = await Meta.findOne({ contract_key, token_id }).populate('collection_id');

  if (meta) {
    if (
      transaction.tx.block_height > meta.list_block_height ||
      (transaction.tx.block_height == meta.list_block_height && transaction.tx.tx_index > meta.list_tx_index) ||
      !meta.list_block_height
    ) {
      (meta.list_contract = second_market),
        (meta.listed = true),
        (meta.list_price = price),
        (meta.collection_map_id = contract_key || null),
        (meta.list_seller = extractSenderAddress(transaction.tx)),
        (meta.list_block_height = transaction.tx.block_height),
        (meta.list_tx_index = transaction.tx.tx_index),
        (meta.commission_key = `${second_market}::${contract_key}`);

      await meta.save();
      console.log(`New Listing: ${meta.name} - ${transaction.tx_id}`);

      if (reportNotifications) {
        await discordHelper.discordListing(meta, transaction.tx, relist);
      }

      let commission = await Commission.findOne({ commission_key: meta.commission_key });
      console.log(commission);

      try {
        let action = new Action({
          marketplace_id: market._id,
          meta_id: meta._id,
          collection_id: meta.collection_id,
          contract_key: meta.contract_key,
          action: 'relist',
          commission: meta.commission || null,
          market_name: commission?.market_name || 'stxnft',
          list_price: price,
          seller: extractSenderAddress(transaction.tx),
          block_height: transaction.tx.block_height,
          tx_index: transaction.tx.tx_index,
          burn_block_time_iso: transaction.tx.burn_block_time_iso,
          tx_id: transaction.tx_id
        });
        await action.save();
        console.log(`New Action List: ${action._id}`);
      } catch (err) {
        console.error(err);
      }

      console.log('Processed: ', transaction.tx_id);
    } else {
      console.log('Too Late ---', contract_key, market.contract_key);
    }
  } else {
    if (contract_key) {
      console.log('Missing: --- ', contract_key, transaction.tx_id);
    }
  }

  return meta ? true : false;
};

const processChangePriceByzantion = async (transaction, market, reportNotifications) => {
  console.log('processChangePriceByzantion() ', { tx_id: transaction.tx_id });

  console.log(market.change_price_byzantion.function_name);
  const second_market = extractDataFromHex(transaction.tx, market.change_price_byzantion.second_market);
  const contract_key = extractContractKey(transaction, market.change_price_byzantion.contract_key);
  const token_id = extractDataFromHex(transaction.tx, market.change_price_byzantion.token_id);
  const price = extractDataFromHex(transaction.tx, market.change_price_byzantion.price);

  let meta = await Meta.findOne({ contract_key, token_id }).populate('collection_id');

  if (meta) {
    if (
      transaction.tx.block_height > meta.list_block_height ||
      (transaction.tx.block_height == meta.list_block_height && transaction.tx.tx_index > meta.list_tx_index) ||
      !meta.list_block_height
    ) {
      (meta.list_contract = second_market),
        (meta.listed = true),
        (meta.list_price = price),
        (meta.collection_map_id = contract_key || null),
        (meta.list_seller = extractSenderAddress(transaction.tx)),
        (meta.list_block_height = transaction.tx.block_height),
        (meta.list_tx_index = transaction.tx.tx_index),
        (meta.commission_key = `${second_market}::${contract_key}`);

      await meta.save();
      console.log(`New Listing: ${meta.name} - ${transaction.tx_id}`);

      if (reportNotifications) {
        await discordHelper.discordListing(meta, transaction.tx, 'relist');
      }

      let commission = await Commission.findOne({ commission_key: meta.commission_key });
      console.log(commission);

      try {
        let action = new Action({
          marketplace_id: market._id,
          meta_id: meta._id,
          collection_id: meta.collection_id,
          contract_key: meta.contract_key,
          action: 'relist',
          commission: meta.commission || null,
          market_name: commission?.market_name || 'stxnft',
          list_price: price,
          seller: extractSenderAddress(transaction.tx),
          block_height: transaction.tx.block_height,
          tx_index: transaction.tx.tx_index,
          burn_block_time_iso: transaction.tx.burn_block_time_iso,
          tx_id: transaction.tx_id
        });
        await action.save();
        console.log(`New Action List: ${action._id}`);
      } catch (err) {
        console.error(err);
      }

      console.log('Processed: ', transaction.tx_id);
    } else {
      console.log('Too Late ---', contract_key, market.contract_key);
    }
  } else {
    if (contract_key) {
      console.log('Missing: --- ', contract_key, transaction.tx_id);
    }
  }

  return meta ? true : false;
};

const processChangePriceStacksArt = async (transaction, market, reportNotifications) => {
  console.log('processChangePriceStacksArt() ', { tx_id: transaction.tx_id });
  console.log(market.change_price_stacksart.function_name);
  //const first_market = extractDataFromHex(transaction.tx, market.change_price_stacksart.first_market);
  const second_market = extractDataFromHex(transaction.tx, market.change_price_stacksart.second_market);
  const contract_key = extractContractKey(transaction, market.change_price_stacksart.contract_key);
  const token_id = extractDataFromHex(transaction.tx, market.change_price_stacksart.token_id);
  const price = extractDataFromHex(transaction.tx, market.change_price_stacksart.price);

  let meta = await Meta.findOne({ contract_key, token_id }).populate('collection_id');

  if (meta) {
    if (
      transaction.tx.block_height > meta.list_block_height ||
      (transaction.tx.block_height == meta.list_block_height && transaction.tx.tx_index > meta.list_tx_index) ||
      !meta.list_block_height
    ) {
      (meta.list_contract = second_market),
        (meta.listed = true),
        (meta.list_price = price),
        (meta.collection_map_id = contract_key || null),
        (meta.list_seller = extractSenderAddress(transaction.tx)),
        (meta.list_block_height = transaction.tx.block_height),
        (meta.list_tx_index = transaction.tx.tx_index),
        (meta.commission_key = `${second_market}::${contract_key}`);

      await meta.save();
      console.log(`New Listing: ${meta.name} - ${transaction.tx_id}`);

      if (reportNotifications) {
        await discordHelper.discordListing(meta, transaction.tx, 'relist');
      }

      let commission = await Commission.findOne({ commission_key: meta.commission_key });
      console.log(commission);

      try {
        let action = new Action({
          marketplace_id: market._id,
          meta_id: meta._id,
          collection_id: meta.collection_id,
          contract_key: meta.contract_key,
          action: 'relist',
          commission: meta.commission || null,
          market_name: commission?.market_name || 'stxnft',
          list_price: price,
          seller: extractSenderAddress(transaction.tx),
          block_height: transaction.tx.block_height,
          tx_index: transaction.tx.tx_index,
          burn_block_time_iso: transaction.tx.burn_block_time_iso,
          tx_id: transaction.tx_id
        });
        await action.save();
        console.log(`New Action List: ${action._id}`);
      } catch (err) {
        console.error(err);
      }

      console.log('Processed: ', transaction.tx_id);
    } else {
      console.log('Too Late ---', contract_key, market.contract_key);
    }
  } else {
    if (contract_key) {
      console.log('Missing: --- ', contract_key, transaction.tx_id);
    }
  }

  return meta ? true : false;
};

const processCollectionOrderBookBid = async (transaction, market, reportNotifications) => {
  try {
    console.log('processCollectionOrderBookBid() ', { tx_id: transaction.tx_id });

    const ob_tx = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction.tx_id}`);
    const events = extractSmartContractLogEvents(ob_tx);

    for (o of events) {
      let event = cvToTrueValue(hexToCV(o.contract_log.value.hex));
      if (event.data && event.data['collection-id']) {
        const contract_key = extractContractKeyFromEvent(event);
        const collection = await Collection.findOne({ contract_key });

        let newCollectionBid = new CollectionBid({
          collection_id: collection._id,
          contract_key: contract_key,
          bid_contract: o.contract_log.contract_id,
          nonce: Number(event.order),
          bid_contract_nonce: `${o.contract_log.contract_id}::${Number(event.order)}`,
          bid_price: Number(event.data.offer),
          bid_buyer: event.data.buyer,
          status: 'active',
          tx_id: transaction.tx_id,
          block_height: transaction.tx.block_height,
          bid_type: 'collection'
        });

        try {
          const bid = await newCollectionBid.save();
          console.log('Collection Bid saved: ', bid);
        } catch (err) {
          console.error(err);
          console.error('Collection Bid Already exists: ', newCollectionBid.nonce);
        }

        let action = new Action({
          marketplace_id: market._id,
          collection_id: collection._id,
          contract_key: newCollectionBid.contract_key,
          action: 'collection-bid',
          bid_price: newCollectionBid.bid_price,
          buyer: newCollectionBid.bid_buyer,
          block_height: ob_tx.data.block_height,
          tx_index: ob_tx.data.tx_index,
          tx_id: ob_tx.data.tx_id,
          burn_block_time_iso: ob_tx.data.burn_block_time_iso,
          market_name: market.market_name,
          nonce: newCollectionBid.nonce
        });

        try {
          await action.save();
          console.log('New Action: ', action.action);
        } catch (err) {
          console.error('Action Already exists: ', action.nonce);
        }

        // Send collection-bid post to discord
        if (reportNotifications) {
          discordHelper.collectionBid(collection, action, 'collection-bid');
        }
      }
    }

    console.log('Processed: ', transaction.tx_id);
    return true;
  } catch (err) {
    console.log('Error: ', err);
    return false;
  }
};

const processCollectionMultiOrderBookBid = async (transaction, market, reportNotifications) => {
  console.log('processCollectionMultiOrderBookBid() ', { tx_id: transaction.tx_id });
  try {
    const ob_tx = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction.tx_id}`);
    const events = extractSmartContractLogEvents(ob_tx);

    for (let o of events) {
      const event = cvToTrueValue(hexToCV(o.contract_log.value.hex));
      if (event.data && event.data['collection-id']) {
        const contract_key = extractContractKeyFromEvent(event);
        const collection = await Collection.findOne({ contract_key });

        let newCollectionBid = new CollectionBid({
          collection_id: collection._id,
          contract_key: contract_key,
          bid_contract: o.contract_log.contract_id,
          nonce: Number(event.order),
          bid_contract_nonce: `${o.contract_log.contract_id}::${Number(event.order)}`,
          bid_price: Number(event.data.offer),
          bid_buyer: event.data.buyer,
          status: 'active',
          tx_id: transaction.tx_id,
          block_height: transaction.tx.block_height,
          bid_type: 'collection'
        });

        try {
          const bid = await newCollectionBid.save();
          console.log('Collection Bid saved: ', bid);
        } catch (err) {
          console.warn('Collection Bid Already exists: ', newCollectionBid.nonce);
          console.error(err);
        }
      }
    }

    const contract_key = extractContractKey(
      transaction,
      market.collection_multi_order_book_bid_function.collection_map_id
    );
    const collection = await Collection.findOne({ contract_key });

    let action = new Action({
      marketplace_id: market._id,
      collection_id: collection._id,
      contract_key: contract_key,
      action: 'multi-collection-bid',
      bid_price: extractDataFromHex(transaction.tx, market.collection_multi_order_book_bid_function.bid_price),
      buyer: extractSenderAddress(transaction.tx),
      block_height: ob_tx.data.block_height,
      tx_index: ob_tx.data.tx_index,
      tx_id: ob_tx.data.tx_id,
      burn_block_time_iso: ob_tx.data.burn_block_time_iso,
      market_name: market.market_name,
      units: extractDataFromHex(transaction.tx, market.collection_multi_order_book_bid_function.units)
    });

    try {
      await action.save();
      console.log('New Action: ', action.action);
    } catch (err) {
      console.log('Action Already exists: ', action.tx_id);
    }

    // Send collection-bid post to discord
    if (reportNotifications) {
      discordHelper.collectionBid(collection, action, 'collection-bid');
    }

    console.log('Processed: ', transaction.tx_id);
    return true;
  } catch (err) {
    console.log('Error: ', err);
    return false;
  }
};

const processCollectionOrderBookAcceptBid = async (transaction, market, reportNotifications) => {
  console.log('processCollectioOrderBookAcceptBid() ', { tx_id: transaction.tx_id });
  try {
    const ob_tx = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction.tx_id}`);
    const events = extractSmartContractLogEvents(ob_tx);

    for (let o of events) {
      const event = cvToTrueValue(hexToCV(o.contract_log.value.hex));
      if (event.data && event.order) {
        const collectionBid = await CollectionBid.findOne({
          bid_contract_nonce: `${transaction.contract_key}::${Number(event.order)}`
        });
        if (collectionBid && collectionBid.status !== 'matched') {
          collectionBid.status = 'matched';
          collectionBid.bid_seller = extractSenderAddress(ob_tx.data);
          collectionBid.match_tx_id = ob_tx.data.tx_id;
          collectionBid.token_id = Number(event.data['item-id']);

          console.log(collectionBid);

          try {
            await collectionBid.save();
            console.log('Accept bid order: ', collectionBid.nonce);
          } catch (err) {
            console.log('Err saving acceptance ', collectionBid.nonce, err);
          }

          let meta = await Meta.findOne({ token_id: collectionBid.token_id, contract_key: collectionBid.contract_key });
          if (meta) {
            const newAction = new Action({
              marketplace_id: market._id,
              meta_id: meta._id,
              collection_id: meta.collection_id,
              contract_key: meta.contract_key,
              action: 'accept-collection-bid',
              bid_price: collectionBid.bid_price,
              seller: collectionBid.bid_seller,
              buyer: collectionBid.bid_buyer,
              block_height: ob_tx.data.block_height,
              tx_index: ob_tx.data.tx_index,
              tx_id: ob_tx.data.tx_id,
              burn_block_time_iso: ob_tx.data.burn_block_time_iso,
              market_name: market.market_name,
              nonce: collectionBid.nonce
            });

            try {
              await newAction.save();
              console.log('New Action: accept-collection-bid ');
            } catch (err) {
              console.warn('Action already exists');
            }

            if (reportNotifications) {
              const collection = await Collection.findOne({ contract_key: meta.contract_key });
              discordHelper.collectionBid(collection, newAction, 'collection-accept-bid');
            }
          }
        } else if (collectionBid) {
          console.log('Bid order already "matched"', collectionBid.nonce);
        }
      }
    }

    console.log('Processed: ', transaction.tx_id);
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
};

const processCollectionRemoveOrderBookBid = async (transaction, market) => {
  console.log('processCollectionRemoveOrderBookBid() ', { tx_id: transaction.tx_id });
  try {
    const ob_tx = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction.tx_id}`);
    const events = extractSmartContractLogEvents(ob_tx);

    let collectionBid;
    for (let o of events) {
      const event = cvToTrueValue(hexToCV(o.contract_log.value.hex));
      if (event.data && event.order) {
        collectionBid = await CollectionBid.findOne({
          bid_contract_nonce: `${transaction.contract_key}::${Number(event.order)}`
        });

        if (collectionBid) {
          collectionBid.status = 'cancelled';
          collectionBid.cancel_tx_id = ob_tx.data.tx_id;
          //console.log(collectionBid)

          try {
            await collectionBid.save();
            console.log('Cancelled bid order: ', collectionBid.nonce);
          } catch (err) {
            console.warn('Err saving cancellation ', collectionBid.nonce, err);
          }

          const collection = await Collection.findOne({ contract_key: collectionBid.contract_key });
          let action = new Action({
            marketplace_id: market._id,
            collection_id: collection._id,
            contract_key: collectionBid.contract_key,
            action: 'cancel-collection-bid',
            bid_price: collectionBid.bid_price,
            buyer: collectionBid.bid_buyer,
            block_height: ob_tx.data.block_height,
            tx_index: ob_tx.data.tx_index,
            tx_id: ob_tx.data.tx_id,
            burn_block_time_iso: ob_tx.data.burn_block_time_iso,
            market_name: market.market_name,
            nonce: collectionBid.nonce
          });

          try {
            await action.save();
            console.log('New Action: ', action.action);
          } catch (err) {
            console.warn('Action Already exists: ', action.nonce);
          }

          console.log('Processed: ', transaction.tx_id);
        }
      }
    }

    return collectionBid ? true : false;
  } catch (err) {
    console.log('Error: ', err);
    return false;
  }
};

const processIdBid = async (transaction, market, reportNotifications) => {
  console.log('order book bid: ');
  try {
    const ob_tx = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction.tx_id}`);
    const token_id_list = cvToTrueValue(
      hexToCV(ob_tx.data.contract_call.function_args[market.id_bid_function.token_id_list].hex)
    ).map((i) => Number(i));

    const events = extractSmartContractLogEvents(ob_tx);

    for (let o of events) {
      const event = cvToTrueValue(hexToCV(o.contract_log.value.hex));
      if (event.data && event.data['collection-id']) {
        const contract_key = extractContractKeyFromEvent(event);
        const collection = await Collection.findOne({ contract_key });

        let newCollectionBid = new CollectionBid({
          collection_id: collection._id,
          contract_key: contract_key,
          bid_contract: o.contract_log.contract_id,
          nonce: Number(event.order),
          bid_contract_nonce: `${o.contract_log.contract_id}::${Number(event.order)}`,
          bid_price: Number(event.data.offer),
          token_id_list: token_id_list,
          bid_attributes: JSON.parse(event.trait),
          bid_buyer: event.data.buyer,
          status: 'active',
          tx_id: transaction.tx_id,
          block_height: transaction.tx.block_height,
          bid_type: 'attribute'
        });

        try {
          const bid = await newCollectionBid.save();
          console.log('Order Book Bid saved: ', bid);
        } catch (err) {
          console.warn('Order Book Bid Already exists: ', newCollectionBid.nonce);
          console.error(err);
        }

        let action = new Action({
          marketplace_id: market._id,
          collection_id: collection._id,
          contract_key: newCollectionBid.contract_key,
          action: 'attribute-bid',
          bid_price: newCollectionBid.bid_price,
          buyer: newCollectionBid.bid_buyer,
          block_height: ob_tx.data.block_height,
          tx_index: ob_tx.data.tx_index,
          tx_id: ob_tx.data.tx_id,
          burn_block_time_iso: ob_tx.data.burn_block_time_iso,
          market_name: market.market_name,
          nonce: newCollectionBid.nonce
        });

        try {
          await action.save();
          console.log('New Action: ', action.action);
        } catch (err) {
          console.log('Action Already exists: ', action.nonce);
        }

        // Send attribute-bid post to discord
        if (reportNotifications) {
          discordHelper.attributeBid(collection, action, newCollectionBid, 'attribute-bid');
        }

        console.log('Processed: ', transaction.tx_id);
      }
    }
    return true;
  } catch (err) {
    console.log('Error: ', err);
    return false;
  }
};

const processSoloIdBid = async (transaction, market) => {
  console.log('process solo bid: ');
  try {
    const ob_tx = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction.tx_id}`);
    const token_id_list = Number(
      cvToTrueValue(hexToCV(ob_tx.data.contract_call.function_args[market.solo_id_bid_function.token_id].hex))
    );
    console.log(token_id_list);
    const events = extractSmartContractLogEvents(ob_tx);

    for (let o of events) {
      event = cvToTrueValue(hexToCV(o.contract_log.value.hex));
      if (event.data && event.data['collection-id']) {
        const collection = await Collection.findOne({ contract_key: event.data['collection-id'].split('::')[0] });

        let newCollectionBid = new CollectionBid({
          collection_id: collection._id,
          contract_key: event.data['collection-id'].split('::')[0],
          bid_contract: o.contract_log.contract_id,
          nonce: Number(event.order),
          bid_contract_nonce: `${o.contract_log.contract_id}::${Number(event.order)}`,
          bid_price: Number(event.data.offer),
          token_id_list: token_id_list,

          bid_buyer: event.data.buyer,
          status: 'active',
          tx_id: transaction.tx_id,
          block_height: transaction.tx.block_height,
          bid_type: 'solo'
        });

        try {
          const bid = await newCollectionBid.save();
          console.log('Solo Bid saved: ', bid);
        } catch (err) {
          console.warn('Solo Bid Already exists: ', newCollectionBid.nonce);
          console.error(err);
        }

        let action = new Action({
          marketplace_id: market._id,
          collection_id: collection._id,
          contract_key: newCollectionBid.contract_key,
          action: 'solo-bid',
          bid_price: newCollectionBid.bid_price,
          buyer: newCollectionBid.bid_buyer,
          block_height: ob_tx.data.block_height,
          tx_index: ob_tx.data.tx_index,
          tx_id: ob_tx.data.tx_id,
          burn_block_time_iso: ob_tx.data.burn_block_time_iso,
          market_name: market.market_name,
          nonce: newCollectionBid.nonce
        });

        try {
          await action.save();
          console.log('New Action: ', action.action);
        } catch (err) {
          console.log('Action Already exists: ', action.nonce);
        }

        console.log('Processed: ', transaction.tx_id);
      }
    }
    return true;
  } catch (err) {
    console.log('Error: ', err);
    return false;
  }
};

const processMultiIdBid = async (transaction, market) => {
  console.log('multi id bid function: ', transaction.tx_id);
  try {
    const ob_tx = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction.tx_id}`);
    const token_id_list = cvToTrueValue(
      hexToCV(ob_tx.data.contract_call.function_args[market.multi_id_bid_function.token_id_list].hex)
    ).map((i) => Number(i));

    const events = extractSmartContractLogEvents(ob_tx);

    for (let o of events) {
      event = cvToTrueValue(hexToCV(o.contract_log.value.hex));
      if (event.data && event.data['collection-id']) {
        const contract_key = extractContractKeyFromEvent(event);
        const collection = await Collection.findOne({ contract_key });

        let newCollectionBid = new CollectionBid({
          collection_id: collection._id,
          contract_key: contract_key,
          bid_contract: o.contract_log.contract_id,
          nonce: Number(event.order),
          bid_contract_nonce: `${o.contract_log.contract_id}::${Number(event.order)}`,
          bid_price: Number(event.data.offer),
          token_id_list: token_id_list,
          bid_attributes: JSON.parse(event.trait),
          bid_buyer: event.data.buyer,
          status: 'active',
          tx_id: transaction.tx_id,
          block_height: transaction.tx.block_height,
          bid_type: 'attribute'
        });

        try {
          const bid = await newCollectionBid.save();
          console.log('Multi Bid saved: ', bid);
        } catch (err) {
          console.warn('Multi Bid Already exists: ', newCollectionBid.nonce);
          console.error(err);
        }
      }
    }

    const contract_key = extractContractKey(transaction, market.multi_id_bid_function.collection_map_id);
    const collection = await Collection.findOne({ contract_key });

    let action = new Action({
      marketplace_id: market._id,
      collection_id: collection._id,
      contract_key: contract_key,
      action: 'multi-attribute-bid',
      bid_attribute: ['Testing'],
      bid_price: extractDataFromHex(transaction.tx, market.multi_id_bid_function.bid_price),
      buyer: extractSenderAddress(transaction.tx),
      block_height: ob_tx.data.block_height,
      tx_index: ob_tx.data.tx_index,
      tx_id: ob_tx.data.tx_id,
      burn_block_time_iso: ob_tx.data.burn_block_time_iso,
      market_name: market.market_name,
      units: extractDataFromHex(transaction.tx, market.multi_id_bid_function.units)
    });

    try {
      await action.save();
      console.log('New Action: ', action.action);
    } catch (err) {
      console.warn(err, 'Action Already exists: ', action.tx_id);
    }

    console.log('Processed: ', transaction.tx_id);
    return true;
  } catch (err) {
    console.log('Error: ', err);
    return false;
  }
};

const processIdRemoveBid = async (transaction, market) => {
  console.log('remove attribute bid: ');

  try {
    const ob_tx = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction.tx_id}`);
    const events = extractSmartContractLogEvents(ob_tx);

    let collectionBid;

    for (let o of events) {
      event = cvToTrueValue(hexToCV(o.contract_log.value.hex));
      if (event.data && event.order) {
        collectionBid = await CollectionBid.findOne({
          bid_contract_nonce: `${transaction.contract_key}::${Number(event.order)}`
        });
        if (collectionBid) {
          collectionBid.status = 'cancelled';
          collectionBid.cancel_tx_id = ob_tx.data.tx_id;

          try {
            await collectionBid.save();
            console.log('Cancelled bid order: ', collectionBid.nonce);
          } catch (err) {
            console.warn('Err saving cancellation ', collectionBid.nonce, err);
          }

          const collection = await Collection.findOne({ contract_key: collectionBid.contract_key });
          let action = new Action({
            marketplace_id: market._id,
            collection_id: collection._id,
            contract_key: collectionBid.contract_key,
            action: 'cancel-attribute-bid',
            bid_price: collectionBid.bid_price,
            buyer: collectionBid.bid_buyer,
            block_height: ob_tx.data.block_height,
            tx_index: ob_tx.data.tx_index,
            tx_id: ob_tx.data.tx_id,
            burn_block_time_iso: ob_tx.data.burn_block_time_iso,
            market_name: market.market_name,
            nonce: collectionBid.nonce
          });

          try {
            await action.save();
            console.log('New Action: ', action.action);
          } catch (err) {
            console.log('Action Already exists: ', action.nonce);
          }
          console.log('Processed: ', transaction.tx_id);
        }
      }
    }

    return collectionBid ? true : false;
  } catch (err) {
    console.log('Error: ', err);
    return false;
  }
};

const processSoloIdRemoveBid = async (transaction, market) => {
  console.log('remove solo id bid: ');

  try {
    const ob_tx = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction.tx_id}`);
    const events = extractSmartContractLogEvents(ob_tx);

    let collectionBid;

    for (let o of events) {
      const event = cvToTrueValue(hexToCV(o.contract_log.value.hex));
      if (event.data && event.order) {
        collectionBid = await CollectionBid.findOne({
          bid_contract_nonce: `${transaction.contract_key}::${Number(event.order)}`
        });
        if (collectionBid) {
          collectionBid.status = 'cancelled';
          collectionBid.cancel_tx_id = ob_tx.data.tx_id;

          try {
            await collectionBid.save();
            console.log('Cancelled bid order: ', collectionBid.nonce);
          } catch (err) {
            console.warn('Err saving cancellation ', collectionBid.nonce, err);
          }

          const collection = await Collection.findOne({ contract_key: collectionBid.contract_key });
          let action = new Action({
            marketplace_id: market._id,
            collection_id: collection._id,
            contract_key: collectionBid.contract_key,
            action: 'unlist-bid',
            bid_price: collectionBid.bid_price,
            buyer: collectionBid.bid_buyer,
            block_height: ob_tx.data.block_height,
            tx_index: ob_tx.data.tx_index,
            tx_id: ob_tx.data.tx_id,
            burn_block_time_iso: ob_tx.data.burn_block_time_iso,
            market_name: market.market_name,
            nonce: collectionBid.nonce
          });

          try {
            await action.save();
            console.log('New Action: ', action.action);
          } catch (err) {
            console.log('Action Already exists: ', action.nonce);
          }
          console.log('Processed: ', transaction.tx_id);
        }
      }
    }

    return collectionBid ? true : false;
  } catch (err) {
    console.log('Error: ', err);
    return false;
  }
};

const processIdAcceptBid = async (transaction, market, reportNotifications) => {
  console.log('multi accept order book: ');
  try {
    const ob_tx = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction.tx_id}`);
    const events = extractSmartContractLogEvents(ob_tx);

    for (let o of events) {
      const event = cvToTrueValue(hexToCV(o.contract_log.value.hex));
      if (event.data && event.order) {
        //console.log(event)
        const collectionBid = await CollectionBid.findOne({
          bid_contract_nonce: `${transaction.contract_key}::${Number(event.order)}`
        });
        if (collectionBid && collectionBid.status !== 'matched') {
          collectionBid.status = 'matched';
          collectionBid.bid_seller = extractSenderAddress(ob_tx.data);
          collectionBid.match_tx_id = ob_tx.data.tx_id;
          collectionBid.token_id = Number(event.data['item-id']);

          try {
            await collectionBid.save();
            console.log('Accept bid order: ', collectionBid.nonce);
          } catch (err) {
            console.log('Err saving acceptance ', collectionBid.nonce, err);
          }

          const meta = await Meta.findOne({
            token_id: collectionBid.token_id,
            contract_key: collectionBid.contract_key
          });
          if (meta) {
            const newAction = new Action({
              marketplace_id: market._id,
              meta_id: meta._id,
              collection_id: meta.collection_id,
              contract_key: meta.contract_key,
              action: 'accept-bid',
              bid_price: collectionBid.bid_price,
              seller: collectionBid.bid_seller,
              buyer: collectionBid.bid_buyer,
              block_height: ob_tx.data.block_height,
              tx_index: ob_tx.data.tx_index,
              tx_id: ob_tx.data.tx_id,
              burn_block_time_iso: ob_tx.data.burn_block_time_iso,
              market_name: market.market_name,
              nonce: collectionBid.nonce
            });

            try {
              await newAction.save();
              console.log('New Action: accept-collection-bid ');
            } catch (err) {
              console.log('Action already exists');
            }

            // Send attribute-bid post to discord
            if (reportNotifications) {
              const collection = await Collection.findOne({ contract_key: meta.contract_key });
              discordHelper.attributeBid(collection, newAction, collectionBid, 'attribute-accept-bid');
            }
          }
        } else if (collectionBid) {
          console.log('Bid order already "matched"', collectionBid.nonce);
        }
      }
    }

    console.log('Processed: ', transaction.tx_id);
    return true;
  } catch (err) {
    console.error('Error: ', err);
    return false;
  }
};

const processSoloIdAcceptBid = async (transaction, market) => {
  console.log('accept solo order book: ');
  try {
    const ob_tx = await axios.get(`https://stacks-node-api.mainnet.stacks.co/extended/v1/tx/${transaction.tx_id}`);
    const events = extractSmartContractLogEvents(ob_tx);

    for (let o of events) {
      const event = cvToTrueValue(hexToCV(o.contract_log.value.hex));
      if (event.data && event.order) {
        //console.log(event)
        const collectionBid = await CollectionBid.findOne({
          bid_contract_nonce: `${transaction.contract_key}::${Number(event.order)}`
        });
        if (collectionBid && collectionBid.status !== 'matched') {
          collectionBid.status = 'matched';
          collectionBid.bid_seller = extractSenderAddress(ob_tx.data);
          collectionBid.match_tx_id = ob_tx.data.tx_id;
          collectionBid.token_id = Number(event.data['item-id']);

          try {
            await collectionBid.save();
            console.log('Accept bid order: ', collectionBid.nonce);
          } catch (err) {
            console.log('Err saving acceptance ', collectionBid.nonce, err);
          }

          const meta = await Meta.findOne({
            token_id: collectionBid.token_id,
            contract_key: collectionBid.contract_key
          });
          if (meta) {
            const newAction = new Action({
              marketplace_id: market._id,
              meta_id: meta._id,
              collection_id: meta.collection_id,
              contract_key: meta.contract_key,
              action: 'accept-bid',
              bid_price: collectionBid.bid_price,
              seller: collectionBid.bid_seller,
              buyer: collectionBid.bid_buyer,
              block_height: ob_tx.data.block_height,
              tx_index: ob_tx.data.tx_index,
              tx_id: ob_tx.data.tx_id,
              burn_block_time_iso: ob_tx.data.burn_block_time_iso,
              market_name: market.market_name,
              nonce: collectionBid.nonce
            });

            try {
              await newAction.save();
              console.log('New Action: accept-collection-bid ');
            } catch (err) {
              console.log('Action already exists');
            }
          }
        } else if (collectionBid) {
          console.log('Bid order already "matched"', collectionBid.nonce);
        }
      }
    }

    console.log('Processed: ', transaction.tx_id);
    return true;
  } catch (err) {
    console.error('Error: ', err);
    return false;
  }
};

const processChangePrice = async (transaction, market, reportNotifications, marketFunctionName) => {
  console.log('processRelist() ', { tx_id: transaction.tx_id });

  try {
    const second_market = extractDataFromHex(transaction.tx, market[marketFunctionName].second_market);
    const contract_key = extractContractKey(transaction, market[marketFunctionName].contract_key);
    const token_id = extractDataFromHex(transaction.tx, market[marketFunctionName].token_id);
    const price = extractDataFromHex(transaction.tx, market[marketFunctionName].price);
    const collection_map_id = extractDataFromHex(transaction.tx, market[marketFunctionName].collection_map_id);
    

    let meta = await Meta.findOne({ contract_key, token_id }).populate('collection_id');

    if (meta) {
      if (
        transaction.tx.block_height > meta.list_block_height ||
        (transaction.tx.block_height == meta.list_block_height && transaction.tx.tx_index > meta.list_tx_index) ||
        !meta.list_block_height
      ) {
        (meta.list_contract = second_market),
          (meta.listed = true),
          (meta.list_price = price),
          (meta.collection_map_id = collection_map_id || null),
          (meta.list_seller = extractSenderAddress(transaction.tx)),
          (meta.list_block_height = transaction.tx.block_height),
          (meta.list_tx_index = transaction.tx.tx_index),
          (meta.commission_key = `${second_market}::${contract_key}`);

        await meta.save();
        console.log(`New Listing: ${meta.name} - ${transaction.tx_id}`);

        if (reportNotifications) {
          await discordHelper.discordListing(meta, transaction.tx, 'relist');
        }

        let commission = await Commission.findOne({ commission_key: meta.commission_key });

        try {
          let action = new Action({
            marketplace_id: market._id,
            meta_id: meta._id,
            collection_id: meta.collection_id,
            contract_key: meta.contract_key,
            action: 'relist',
            commission: meta.commission || null,
            market_name: commission?.market_name || 'byzantion',
            list_price: price,
            seller: extractSenderAddress(transaction.tx),
            block_height: transaction.tx.block_height,
            tx_index: transaction.tx.tx_index,
            burn_block_time_iso: transaction.tx.burn_block_time_iso,
            tx_id: transaction.tx_id
          });
          await action.save();
          console.log(`New Action List: ${action._id}`);
        } catch (err) {
          console.error(err);
        }

        console.log('Processed: ', transaction.tx_id);
      } else {
        console.log('Too Late ---', contract_key, market.contract_key);
      }
    } else {
      if (contract_key) {
        console.log('Missing: --- ', contract_key, transaction.tx_id);
      }
    }

    return meta ? true : false;
  } catch (err) {
    console.error(err);
    return false;
  }
};

module.exports = {
  findBnsMeta,
  processTransfer,
  processBuy,
  processList,
  processUnlist,
  processBid,
  processUnlistBid,
  processAcceptBid,
  processCollectionBid,
  processCollectionUnlistBid,
  processCollectionAcceptBid,
  processRelist,
  processBnsRegister,
  processBnsBid,
  processBnsAcceptBid,
  processBnsUnlistBid,
  processBnsAsk,
  processBnsRemoveAsk,
  processStake,
  processUnstake,
  processUpgrade,
  processUpgradeMega,
  processRename,
  processChangePriceSTXNFT,
  processChangePriceByzantion,
  processChangePriceStacksArt,
  processCollectionOrderBookBid,
  processCollectionMultiOrderBookBid,
  processCollectionOrderBookAcceptBid,
  processCollectionRemoveOrderBookBid,
  processIdBid,
  processMultiIdBid,
  processIdRemoveBid,
  processIdAcceptBid,
  processSoloIdBid,
  processSoloIdRemoveBid,
  processSoloIdAcceptBid
};
