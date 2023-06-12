const { expect } = require("chai");

describe("TheDAO", function () {
  it("Should perform re-entrancy attack", async function () {
    const [owner, attacker, user1, user2] = await ethers.getSigners();
    
    // 部署目标合约
    const TheDAOFactory = await ethers.getContractFactory("TheDAO");
    const theDAO = await TheDAOFactory.deploy();
    await theDAO.deployed();
    
    // 部署攻击合约
    const TheDAOAttackerFactory = await ethers.getContractFactory("TheDAOAttacker");
    const theDAOAttacker = await TheDAOAttackerFactory.deploy(theDAO.address);
    await theDAOAttacker.deployed();

    // 使用多个地址向目标合约存入以太币
    const depositAmount = ethers.utils.parseEther("1");
    await theDAO.connect(owner).deposit({ value: depositAmount });
    await theDAO.connect(user1).deposit({ value: depositAmount });
    await theDAO.connect(user2).deposit({ value: depositAmount });
    
    // 攻击者通过攻击合约存入1个Ether
    const attackerInitialBalance = await attacker.getBalance();
    await theDAOAttacker.connect(attacker).attack({ value: depositAmount, gasLimit: 4000000 });

    // 检查攻击者的余额，应该大于最初的余额
    const attackerFinalBalance = await attacker.getBalance();
    expect(attackerFinalBalance).to.be.gt(attackerInitialBalance);
  });
});