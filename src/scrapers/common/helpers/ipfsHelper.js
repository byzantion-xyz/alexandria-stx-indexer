const axios = require('axios').default;
const pinataGatewayUrl = 'https://byzantion.mypinata.cloud/ipfs/'
const pinataApiKey = '6c5c98bf2b9c3f63f565'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

exports.pinIpfsFolder = async (ipfsUrl, pinName) => {
  const pinHash = exports.getPinHashFromUrl(ipfsUrl);

  let isPinning = await checkIfPinning(pinHash);
  if (!isPinning) {
    let isPinned = await exports.checkIfAlreadyPinned(pinHash);
    if (!isPinned) {
      const byzPinataResponse = await pinByHash(pinHash, pinName);
      console.log(byzPinataResponse.data);

      // Add a check to see if pin completed before proceeding, otherwise wait and try again
      for (let i = 0; i < 24; i++) {
        await delay(5000); // delay 5 seconds at a time for a max of 2 mins
        isPinned = await exports.checkIfAlreadyPinned(pinHash);
        if (isPinned) break; // break when pin has completed
      }

      if (!isPinned) isPinning = true; //throw new Error(`Error. Timeout experienced while waiting to pin ${pinHash}`);
    }
  }

  return {
    pin_status: isPinning ? 'pinning' : 'pinned',
    pinHash,
    pinHashUrl: `${pinataGatewayUrl}${pinHash}`
  };
};

exports.getPinHashFromUrl = (ipfsUrl) => {

  //https://cloudflare-ipfs.com/ipfs/QmP3shtToBeoeHizRtvgUPJTeGbcVn2rdZhERSwEiQHtJh
  //https://bafybeic6xpqfeirsmfszjjonassdwaif56focrxw44n4gabqippnn4tjuq.ipfs.dweb.link
  //https://dev.nagmi.art/ipfs/QmapNeyQBV14ZMJFU7WAW2sV5ZnMpKj6f7VCE4kfctDxWb
  //https://ipfs.io/ipfs/bafybeibvdkthkvso4lrxaxazfof2qs6bkjwikfubktiojlksz3tj5txdyi

  ipfsUrl = ipfsUrl.replace(/"/g, '');
  let ipfs_no_protocol;
  if (ipfsUrl.startsWith('ipfs://')) {
    ipfs_no_protocol = ipfsUrl.replace('ipfs://', '').replace('ipfs/', '');
  }
  if (ipfsUrl.startsWith('https://')) {
    ipfs_no_protocol = ipfsUrl.substring(ipfsUrl.indexOf('/ipfs/')).replace('/ipfs/', '');
  }

  const pinHash = ipfs_no_protocol.includes('/')
    ? ipfs_no_protocol.slice(0, ipfs_no_protocol.indexOf('/'))
    : ipfs_no_protocol;
  if (pinHash.length < 46) {
    throw new Error(
      `Unable to extract pinhash. Something is wrong with the ipfs_url received from contract: ${ipfsUrl}`
    );
  }
  return pinHash;
};

exports.getByzMetaIpfsUrl = (ipfs, token_id) => {
  return ipfs.value.value.data
    .replace(/"/g, '')
    .replace('ipfs://ipfs/', pinataGatewayUrl)
    .replace('ipfs://', pinataGatewayUrl)
    .replace('{id}', token_id)
    .replace(`$TOKEN_ID`, token_id);
};

exports.getByzImageIpfsUrl = (ipfsUrl) => {
  return ipfsUrl
    .replace('ipfs://ipfs/', pinataGatewayUrl)
    .replace('ipfs://', pinataGatewayUrl)
    .replace('https://cloudflare-ipfs.com/ipfs/', pinataGatewayUrl);
};

const checkIfPinning = async (pinHash) => {
  const url = `https://api.pinata.cloud/pinning/pinJobs?ipfs_pin_hash=${pinHash}`;
  const response = await axios.get(url, {
    headers: { pinata_api_key: pinataApiKey, pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY }
  });
  if (response.count > 0 && response.rows[0].status === 'prechecking') return true;
  return false;
};

exports.checkIfAlreadyPinned = async (pinHash) => {
  const url = `https://api.pinata.cloud/data/pinList?status=pinned&hashContains=${pinHash}`;
  const response = await axios.get(url, {
    headers: { pinata_api_key: pinataApiKey, pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY }
  });
  return response.data.count > 0;
};

const pinByHash = async (hashToPin, name) => {
  const url = `https://api.pinata.cloud/pinning/pinByHash`;
  const body = {
    hashToPin: hashToPin,
    pinataMetadata: {
      name: name
    }
  };
  try {
    const pinResponse = await axios.post(url, body, {
      headers: {
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY
      }
    });
    return pinResponse;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

// Fetch all the pinned meta from IPFS and return it in an array
exports.getPinnedMeta = async (meta_token_uri, first_token, batch_size = 10) => {
  const pinnedMeta = [];
  let i = first_token;
  try {
    let fetchPromises = [];
    while (true) {
      let lastUrl;
      let isSingleMetaCollection = false;

      try {
        for (let j = 0; j < batch_size; j++) {
          const url = createMetaIpfsUrl(meta_token_uri, first_token, i);
          // Test whether this is a single meta collection
          if (j === 1 && lastUrl === url) {
            isSingleMetaCollection = true;
            break;
          }
          lastUrl = url;
          fetchPromises.push(fetchMeta(url));
          i++;
        }
        if ((i - 1) % 100 === 0) console.log('Metas retrieved:', i - 1);
      } catch (err) {
        console.log(`Error getting pinned meta. Continuing with the ${i} meta already retrieved.`);
      }

      let results;
      try {
        results = await Promise.all(fetchPromises);
      } catch (err) {
        console.log(err.message);
      }
      // push fetched meta into pinnedMeta
      if (results) {
        pinnedMeta.push(...results.filter((r) => r.status == 200).map((r) => r.data));
        // check for break out of loop
        if (results.find((r) => r.status !== 200) || isSingleMetaCollection) {
          break;
        }
      }

      fetchPromises = [];
    }
    return {
      meta_count: pinnedMeta.length,
      metas: pinnedMeta
    };
  } catch (err) {
    console.log('Error in getPinnedMeta'); // error.response.status
    console.error(err.message);

    return {
      meta_count: pinnedMeta.length,
      metas: pinnedMeta,
      msg: 'Error trying to fetch pinned metas'
    };
  }
};

const createMetaIpfsUrl = (url, first_token, iteration) => {
  if (url.includes('{id}')) return url.replace('{id}', iteration.toString());

  const splits = url.split('/');
  let meta_file = splits[splits.length - 1];
  if (meta_file.includes(first_token.toString())) {
    meta_file = meta_file.replace(first_token.toString(), iteration.toString());
    splits[splits.length - 1] = meta_file;
    return splits.join('/');
  }

  return url;
};

const fetchMeta = (url) => {
  return axios.get(url, {
    validateStatus: function (status) {
      return status >= 200 && status < 500;
    }
  });
};
