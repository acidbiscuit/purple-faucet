// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @dev Mock token contract used for testing purposes.
 */
contract MockToken is ERC20 {
    string internal constant _NAME = "Mock Token";
    string internal constant _SYMBOL = "MOCK";
    uint256 internal constant _TOTAL_SUPPLY = 300000 ether;

    constructor() ERC20(_NAME, _SYMBOL) {
        _mint(msg.sender, _TOTAL_SUPPLY);
    }
}
