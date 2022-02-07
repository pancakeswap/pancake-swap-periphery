const CybarRouter01 = artifacts.require("CybarRouter01");
const CybarRouter02 = artifacts.require("CybarRouter02");
const ERC20 = artifacts.require("ERC20");
const WFTM = artifacts.require("WFTM9");

module.exports = async function(deployer, network, accounts) {
    let walletAddress, cybarAddress;
    if(network=='localDeployment'){
        let initialLiquidity = "1000000000000000000000000";
        let cybarFactoryAddress = "0xb145c7F8A54BF8e624Cb86Bde100B96e3B202Ff6"; // INSERT FACTORY ADDRESS HERE
        await deployer.deploy(WFTM);
        let wftm = await WFTM.deployed();
        await deployer.deploy(ERC20, initialLiquidity);
        let dm0 = await ERC20.deployed();
        await deployer.deploy(ERC20, initialLiquidity);
        let dm1 = await ERC20.deployed();
        await deployer.deploy(CybarRouter01, cybarFactoryAddress, wftm.address);
        let cybarRouter = await CybarRouter01.deployed();
        await dm0.approve(cybarRouter.address, initialLiquidity);
        await dm1.approve(cybarRouter.address, initialLiquidity);
        await cybarRouter.addLiquidity(
            dm0.address,
            dm1.address,
            "100000",
            "100000",
            "0",
            "0",
            accounts[0],
            "2644234617" 
        );
    }
};

