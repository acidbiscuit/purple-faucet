// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";

contract PurpleFaucet is Ownable, Pausable {
  using SafeERC20 for IERC20;
  using Counters for Counters.Counter;

  uint256 private _payoutAmount = 0.0001 ether;
  uint256 private _fundedAmount = 0;
  uint256 private _lockTime = 7 days;
  mapping(address => uint256) _lockedAddresses;

  Counters.Counter private _payoutsCount;
  uint256 private _totalPayoutsAmount = 0;

  event FaucetPayout(
    address indexed receiver,
    uint256 amount
  );

  event FaucetFunded(
    address sender,
    uint256 amount
  );

  receive()
  external
  payable
  {
    if (msg.value > 0) {
      emit FaucetFunded(
        msg.sender,
        msg.value
      );

      _fundedAmount += msg.value;
    }
  }

  /**
   * @dev Withdraws configured payout amount to a provided receiver address.
   */
  function payout(address receiver)
  public
  onlyOwner()
  whenNotPaused()
  {
    // Check that faucet has enough funds
    require(_hasEnoughBalance(), "Faucet has insufficient balance");
    // Check receiver has not withdrawn funds within _lockTime
    require(_lockedAddresses[receiver] < block.timestamp, "Receiver has time lock");
    // Check receiver balance has less funds than transfer amount
    require(receiver.balance < _payoutAmount, "Receiver has more balance than current payout amount");
    // Check if receiver is not a contract
    require(!_isContract(receiver), "Receiver is a contract");
    // Perform the transfer
    payable(receiver).transfer(_payoutAmount);

    emit FaucetPayout(
      receiver,
      _payoutAmount
    );
    // Save lock time for recipient account
    _lockedAddresses[receiver] = block.timestamp + _lockTime;

    _updateStats(_payoutAmount);
  }

  /**
   * @dev Distribute transaction costs to owner wallet
   */
  function fundOwner()
  payable
  public
  onlyOwner()
  {
    require(owner().balance < 1 ether, "Owner has enough balance for transaction fees");

    payable(msg.sender).transfer(1 ether);
  }

  /**
   * @dev Withdraw ERC20 token to owner wallet in case any tokens accidentally deposited to the faucet
   */
  function withdrawToken(
    address token
  )
  public
  onlyOwner()
  {
    IERC20 tokenContract = IERC20(address(token));

    // Check if faucet has allowance to spend token
    require(
      _hasTokenAllowance(
        tokenContract,
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
      ),
      "Token approval failed"
    );

    tokenContract.safeTransferFrom(address(this), owner(), _getTokenBalance(tokenContract));
  }

  /**
   * @dev Returns lock end time for an address
   */
  function getAddressLockTime(address _address)
  public
  view
  returns (uint256)
  {
    return _lockedAddresses[_address];
  }

  /**
   * @dev Returns payout stats
   */
  function getStats()
  public
  view
  returns (uint256, uint256, uint256)
  {
    return (_payoutsCount.current(), _totalPayoutsAmount, _fundedAmount);
  }

  /**
   * @dev Returns payout amount
   */
  function getPayoutAmount()
  public
  view
  returns (uint256)
  {
    return _payoutAmount;
  }

  /**
   * @dev Returns lock time
   */
  function getLockTime()
  public
  view
  returns (uint256)
  {
    return _lockTime;
  }

  /**
   * @dev Sets payout amount
   */
  function setTransferAmount(uint256 amount)
  public
  onlyOwner()
  {
    _payoutAmount = amount;
  }

  /**
   * @dev Sets lock time
   */
  function setLockTime(uint256 lockTime)
  public
  onlyOwner()
  {
    _lockTime = lockTime;
  }

  /**
   * @dev Pause all withdrawals
   */
  function pauseWithdrawals()
  public
  onlyOwner()
  whenNotPaused()
  {
    _pause();
  }

  /**
   * @dev Unpause withdrawals for paused faucet
   */
  function resumeWithdrawals()
  public
  onlyOwner()
  whenPaused()
  {
    _unpause();
  }

  /**
   * @dev Returns true if faucet has enough balance to perform a transfer.
   */
  function _hasEnoughBalance()
  internal
  view
  returns (bool)
  {
    return address(this).balance >= _payoutAmount;
  }

  /**
   * @dev Returns true if faucet has enough `token` balance to perform a transfer.
   */
  function _getTokenBalance(IERC20 token)
  internal
  view
  returns (uint256)
  {
    return token.balanceOf(address(this));
  }

  function _hasTokenAllowance(IERC20 token, uint256 amount) internal returns (bool) {
    return token.approve(address(this), amount);
  }

  /**
   * @dev Increment payouts count and amount
   */
  function _updateStats(uint256 _amount) internal {
    _payoutsCount.increment();
    _totalPayoutsAmount = _totalPayoutsAmount + _amount;
  }

  /**
   * @dev Check if provided address is a contract
   */
  function _isContract(address _address)
  private
  view
  returns (bool)
  {
    return _address.code.length > 0;
  }
}
