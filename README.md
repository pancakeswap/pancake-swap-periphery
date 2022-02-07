# Cybar Router

The following assumes the use of `node@>=10`.

## Install Dependencies

`yarn`

## Compile Contracts

`yarn compile`

## Run Tests

### Preparation

The Cybar Router uses the CybarLibrary in order to get the address of a pair for a given token pair. This is done by using the hash value of the compiled CybarPair contract. As this repository uses a different compiler version, the hash value of the CybarPair contract is different than the one used in the cybar-swap-core repository. In order for the tests to run, the hash value for the tests (labeled by a comment) has to be commented in and the deployment hash has to be commented out.  
Then run
`yarn test`

## Migration

### Local Deployment

In order for the periphery contracts to be deployed to a local testnet the core contracts have to be deployed first. For this, first start your local ganache instance, by either opening the ganache gui or using the command line tool. Note that the port in the truffle-config.js has to be 7545 when using the gui and 8545 when using the command line tool. Adjust this also in the cybar-swap-core repository. Then deploy the core contracts by running from the core repository
```
yarn truffle migrate --network localDeployment
```
The last block of the migration output should contain
```
   Replacing 'CybarFactory'
   ------------------------
   > transaction hash:    0x351a66fe73be350d460b436cd5b4343456bdfad6c12c195a3239b7289ab7d182
   > Blocks: 0            Seconds: 0
   > contract address:    0xb145c7F8A54BF8e624Cb86Bde100B96e3B202Ff6
   > block number:        5
   > block timestamp:     1644233816
   > account:             0x4175dd83AA3D00f264070EDDAF5ed393a1Ccc391
   > balance:             99.86928084
   > gas used:            4173564 (0x3faefc)
   > gas price:           20 gwei
   > value sent:          0 ETH
   > total cost:          0.08347128 ETH
```
Copy the address of the factory contract into migration/2_deploy_contracts.js  
Then run 
```
yarn truffle migrate --network localDeployment
```
from the cybar-swap-periphery folder.

## Troubleshooting

The most common culprit is the hash value in the CybarLibrary contract. After the deployment of the CybarFactory from the cybar-swap-core repository a hash value is printed to console after the deployment of the CybarFactory, check if this hash value corresponds to the one in the CybarLibrary and replace it if it differs.  
Another point of failure is, that the CybarPair have a minimal amount for their reserves, it should be around 1000. When liquidity is added for the first time, it has to exceed this amount.
Lastly, don't forget to approve the CybarRouter for the token that is being used before interacting with the CybarRouter contract.
