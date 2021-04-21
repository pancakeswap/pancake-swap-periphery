const { MAX_INTEGER } = require('ethereumjs-util');

const Migrations = artifacts.require("Migrations");
const WETH = artifacts.require("WETH");
const GreenToken = artifacts.require("GreenToken");
const YellowToken = artifacts.require("YellowToken");
const PancakeRouter01 = artifacts.require("PancakeRouter01");

module.exports = async (deployer, net, accs) => {
  await deployer.deploy(Migrations);
  const weth = await deployer.deploy(WETH);
  const greenToken = await deployer.deploy(GreenToken);
  const yellowToken = await deployer.deploy(YellowToken);
  const router = await deployer.deploy(PancakeRouter01, '0xD02F09b5131B9593BCBee5427562908f0F806Dda', WETH.address);

  await weth.approve(router.address, MAX_INTEGER);
  await greenToken.approve(router.address, MAX_INTEGER);
  await yellowToken.approve(router.address, MAX_INTEGER);

  await router.addLiquidity(GreenToken.address, YellowToken.address, toWei('100'), toWei('100'), toWei('100'), toWei('100'), accs[0] ,toWei(toWei('1')))

  console.log("Green Token: ", GreenToken.address);  
  console.log("Yellow Token: ", YellowToken.address); 
};

const toWei = (w) => web3.utils.toWei(w)

//WETH 0x11E3E9f259e0273369542D1a1eE315e0EA065Cd0
//Router01 0xCc58f119a8D0598EeEf19b6E5Bff07c9a0Bc4A17

//Green Token:  0x381316ed98bcd9E28661F953DECc22f910Fa98fD
// Yellow Token:  0x5683e8c773E9fD01CAa9bD59b74f7Ed925745774