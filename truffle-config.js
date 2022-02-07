const HDWalletProvider = require('@truffle/hdwallet-provider');
const fs = require('fs');
const web3 = require('web3');
const mnemonic = fs.readFileSync("mnemonic").toString().trim();

module.exports = {
  networks: {
      development: {
         host: "127.0.0.1",
         port: 8545,
         network_id: "*"
      },
      localDeployment: {
          host: "127.0.0.1",
          port: 7545,
          network_id: "*"
      },
      testnet: {
          provider: () => new HDWalletProvider(mnemonic, `https://data-seed-prebsc-1-s1.binance.org:8545`),
          network_id: 97,
          confirmations: 10,
          timeoutBlocks: 200,
          skipDryRun: true
      },
      fantomTestnet: {
          //provider: () => new HDWalletProvider(mnemonic, `https://data-seed-prebsc-1-s1.binance.org:8545`),
          provider: () => new HDWalletProvider(mnemonic, 'https://rpc.testnet.fantom.network/'),
          network_id: 0xfa2,
          confirmation: 10,
          timeoutBlocks: 200,
          skipDryRun: true
      }
  },
  
  compilers: {
    solc: {
      version: "0.6.6"
    }
  }
};
