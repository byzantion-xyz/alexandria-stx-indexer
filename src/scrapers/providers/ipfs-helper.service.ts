import { Injectable, Logger } from '@nestjs/common';
const axios = require('axios').default;
const pinataGatewayUrl = 'https://byzantion.mypinata.cloud/ipfs/'
const pinataApiKey = '6c5c98bf2b9c3f63f565'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class IpfsHelperService {
  private readonly logger = new Logger(IpfsHelperService.name);

  async pinIpfsFolder(ipfsUrl, pinName) {
    const pinHash = this.getPinHashFromUrl(ipfsUrl);
    
    let isPinning = await this.checkIfPinning(pinHash);
    if (!isPinning) {
      let isPinned = await this.checkIfAlreadyPinned(pinHash);
      if (!isPinned) {
        const byzPinataResponse = await this.pinByHash(pinHash, pinName);
        console.log(byzPinataResponse.data);
  
        // Add a check to see if pin completed before proceeding, otherwise wait and try again
        for (let i = 0; i < 24; i++) {
          await delay(5000); // delay 5 seconds at a time for a max of 2 mins
          isPinned = await this.checkIfAlreadyPinned(pinHash);
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
  
  getPinHashFromUrl(ipfsUrl) {
    ipfsUrl = ipfsUrl.replace(/"/g, '');
    let ipfs_no_protocol;
    if (ipfsUrl.startsWith('ipfs://')) {
      ipfs_no_protocol = ipfsUrl.replace('ipfs://', '').replace('ipfs/', '');
    }
    else if (ipfsUrl.includes('ipfs.dweb.link')) {
      ipfs_no_protocol = ipfsUrl.replace('https://', '').replace('.ipfs.dweb.link', '');
    }
    else if (ipfsUrl.startsWith('https://')) {
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
  
  getByzMetaIpfsUrl(ipfs, token_id) {
    return ipfs.value.value.data
      .replace(/"/g, '')
      .replace('ipfs://ipfs/', pinataGatewayUrl)
      .replace('ipfs://', pinataGatewayUrl)
      .replace('{id}', token_id)
      .replace(`$TOKEN_ID`, token_id);
  };
  
  getByzImageIpfsUrl(ipfsUrl) {
    let url = ipfsUrl
    if (url.includes('ipfs.dweb.link')) {
      return (url.substring(0, ipfsUrl.indexOf('https://')) + pinataGatewayUrl + url.substring(ipfsUrl.indexOf('https://')).replace('https://', '')).replace('.ipfs.dweb.link', '');
    }
    
    return url
      .replace('ipfs://ipfs/', pinataGatewayUrl)
      .replace('ipfs://', pinataGatewayUrl)
      .replace('ipfs.io/', pinataGatewayUrl)
      .replace('dev.nagmi.art/', pinataGatewayUrl)
      .replace('https://cloudflare-ipfs.com/ipfs/', pinataGatewayUrl)
      .replace('https://cloudflare-ipfs.com/ipfs/', pinataGatewayUrl);
  };
  
  async checkIfPinning(pinHash) {
    const url = `https://api.pinata.cloud/pinning/pinJobs?ipfs_pin_hash=${pinHash}`;
    const response = await axios.get(url, {
      headers: { pinata_api_key: pinataApiKey, pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY }
    });
    if (response.count > 0 && response.rows[0].status === 'prechecking') return true;
    return false;
  };
  
  async checkIfAlreadyPinned(pinHash) {
    const url = `https://api.pinata.cloud/data/pinList?status=pinned&hashContains=${pinHash}`;
    const response = await axios.get(url, {
      headers: { pinata_api_key: pinataApiKey, pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY }
    });
    return response.data.count > 0;
  };
  
  async pinByHash(hashToPin, name) {
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
  async getPinnedMeta(meta_token_uri, first_token, batch_size = 10) {
    const pinnedMeta = [];
    let i = first_token;
    try {
      let fetchPromises = [];
      while (true) {
        let lastUrl;
        let isSingleMetaCollection = false;
  
        try {
          for (let j = 0; j < batch_size; j++) {
            const url = this.createMetaIpfsUrl(meta_token_uri, first_token, i);
            // Test whether this is a single meta collection
            if (j === 1 && lastUrl === url) {
              isSingleMetaCollection = true;
              break;
            }
            lastUrl = url;
            fetchPromises.push(this.fetchMeta(url));
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
  
  createMetaIpfsUrl(url, first_token, iteration) {
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
  
  fetchMeta(url) {
    return axios.get(url, {
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      }
    });
  };
}
