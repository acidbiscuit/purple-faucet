import { time, loadFixture, setBalance } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

describe('PurpleFaucet', function () {
  async function deployOneYearLockFixture () {
    const ONE_WEEK_SECS = 24 * 60 * 60 * 7

    const [owner, otherAccount] = await ethers.getSigners()

    const emptyAccount = await ethers.Wallet.createRandom().connect(ethers.provider)
    const emptyAccount2 = await ethers.Wallet.createRandom().connect(ethers.provider)

    const lockTime = ONE_WEEK_SECS
    const PurpleFaucet = await ethers.getContractFactory('PurpleFaucet')
    const purpleFaucet = await PurpleFaucet.deploy()

    const mockContract = await PurpleFaucet.deploy()

    const fundFaucet = async (ether = '0.1') => {
      await owner.sendTransaction({
        to: purpleFaucet.address,
        value: ethers.utils.parseEther(ether)
      })
    }

    return {
      owner,
      purpleFaucet,
      otherAccount,
      lockTime,
      mockContract,
      emptyAccount,
      emptyAccount2,
      fundFaucet
    }
  }

  describe('Deployment', () => {
    it('should have the right owner', async () => {
      const { purpleFaucet, owner } = await loadFixture(deployOneYearLockFixture)
      expect(await purpleFaucet.owner()).to.equal(await owner.getAddress())
    })

    it('should receive ETH', async () => {
      const { purpleFaucet, owner } = await loadFixture(deployOneYearLockFixture)

      const amount = ethers.utils.parseEther('1.1')

      await owner.sendTransaction({
        to: purpleFaucet.address,
        value: amount
      })

      expect(await purpleFaucet.provider.getBalance(purpleFaucet.address)).to.equal(amount)
    })

    it('should set transfer amount', async () => {
      const { purpleFaucet } = await loadFixture(deployOneYearLockFixture)

      const initialPayoutAmount = await purpleFaucet.getPayoutAmount()
      const newAmount = ethers.utils.parseEther('0.0002').add(initialPayoutAmount)

      await purpleFaucet.setTransferAmount(newAmount)

      const payoutAmount = await purpleFaucet.getPayoutAmount()
      expect(payoutAmount).to.not.equal(initialPayoutAmount)
      expect(payoutAmount).to.equal(newAmount)
    })

    it('should set lock time', async () => {
      const { purpleFaucet } = await loadFixture(deployOneYearLockFixture)

      const initialLockTime = await purpleFaucet.getLockTime()
      const newLockTime = initialLockTime + 2
      await purpleFaucet.setLockTime(newLockTime)

      const lockTIme = await purpleFaucet.getLockTime()
      expect(lockTIme).to.not.equal(initialLockTime)
      expect(lockTIme).to.equal(newLockTime)
    })

    it('should set transfer amount only by owner', async () => {
      const { purpleFaucet, otherAccount } = await loadFixture(deployOneYearLockFixture)

      await expect(purpleFaucet.connect(otherAccount).setTransferAmount(ethers.utils.parseEther('0.0002'))).revertedWith('Ownable: caller is not the owner')
    })

    it('should set payout amount only by owner', async () => {
      const { purpleFaucet, otherAccount, lockTime } = await loadFixture(deployOneYearLockFixture)

      await expect(purpleFaucet.connect(otherAccount).setLockTime(lockTime)).revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('Payouts ETH', () => {
    it('should payout to an address', async () => {
      const { purpleFaucet, emptyAccount, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()

      const transferAmount = await purpleFaucet.getPayoutAmount()
      const tx = await purpleFaucet.payout(emptyAccount.address)
      const receipt = await tx.wait()

      expect(await emptyAccount.getBalance()).to.equal(transferAmount)
      expect(receipt.events).to.have.lengthOf(1)
      expect(receipt.events[0].event).to.equal('FaucetPayout')
      expect(receipt.events[0].args).to.have.lengthOf(2)
      expect(receipt.events[0].args[0]).to.equal(await emptyAccount.getAddress())
    })

    it('should throw if recipient has active lock', async () => {
      const { purpleFaucet, emptyAccount, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()

      await purpleFaucet.payout(emptyAccount.address)

      await expect(purpleFaucet.payout(emptyAccount.address)).revertedWith('Receiver has time lock')
    })

    it('should allow transfer once time lock has expired', async () => {
      const { purpleFaucet, emptyAccount, lockTime, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()

      await purpleFaucet.payout(emptyAccount.address)

      await emptyAccount.sendTransaction({
        to: ethers.constants.AddressZero,
        value: ethers.utils.parseEther('0.00001')
      })

      await time.increase(lockTime)

      const tx = await purpleFaucet.payout(emptyAccount.address)
      const receipt = await tx.wait()

      await expect(receipt.status).to.equal(1)
    })

    it('should throw if faucet has insufficient funds', async () => {
      const { purpleFaucet, emptyAccount } = await loadFixture(deployOneYearLockFixture)

      await expect(purpleFaucet.payout(emptyAccount.address)).revertedWith('Faucet has insufficient balance')
    })

    it('should throw if recipient has more balance than payout amount', async () => {
      const { purpleFaucet, otherAccount, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()

      await expect(purpleFaucet.payout(otherAccount.address)).revertedWith('Receiver has more balance than current payout amount')
    })

    it('should throw if recipient is a contract', async () => {
      const { purpleFaucet, mockContract, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()

      await expect(purpleFaucet.payout(mockContract.address)).revertedWith('Receiver is a contract')
    })

    it('should throw if caller is not the owner', async () => {
      const { purpleFaucet, mockContract, otherAccount, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()

      await expect(purpleFaucet.connect(otherAccount).payout(mockContract.address)).revertedWith('Ownable: caller is not the owner')
    })

    it('should return time lock for an address', async () => {
      const { purpleFaucet, emptyAccount, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()

      await purpleFaucet.payout(emptyAccount.address)

      const lockTime = await purpleFaucet.getAddressLockTime(emptyAccount.address)
      expect(lockTime).to.not.equal(0)
    })

    it('should provide owner wallet with transaction fees', async () => {
      const { purpleFaucet, owner, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet('1')
      await setBalance(owner.address, ethers.utils.parseEther('1'))

      await purpleFaucet.fundOwner()

      const ownerBalance = await owner.getBalance()

      expect(ownerBalance).to.be.gt(ethers.utils.parseEther('1'))
    })

    it('should revert owner wallet funding when owner has enough balance', async () => {
      const { purpleFaucet, owner, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()
      await setBalance(owner.address, ethers.utils.parseEther('5'))

      await expect(purpleFaucet.fundOwner()).revertedWith('Owner has enough balance for transaction fees')
    })

    it('should revert owner wallet funding called from non-owner account', async () => {
      const { purpleFaucet, otherAccount, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()
      await setBalance(otherAccount.address, ethers.utils.parseEther('0.1'))

      await expect(purpleFaucet.connect(otherAccount).fundOwner()).revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('Withdraw ERC20', () => {
    it('should withdraw ERC20 to owner', async () => {
      const MockToken = await ethers.getContractFactory('MockToken')
      const { purpleFaucet, owner } = await loadFixture(deployOneYearLockFixture)

      const mockToken = await MockToken.deploy()

      const initialTokenAmount = ethers.utils.parseEther('10')
      await mockToken.approve(owner.address, ethers.constants.MaxUint256)
      await mockToken.transferFrom(owner.address, purpleFaucet.address, initialTokenAmount)

      expect(await mockToken.balanceOf(purpleFaucet.address)).to.equal(initialTokenAmount)

      await purpleFaucet.withdrawToken(mockToken.address)

      expect(await mockToken.balanceOf(owner.address)).to.equal(ethers.utils.parseEther('300000'))
    })

    it('should withdraw ERC20 only by owner', async () => {
      const MockToken = await ethers.getContractFactory('MockToken')
      const { purpleFaucet, owner, otherAccount } = await loadFixture(deployOneYearLockFixture)

      const mockToken = await MockToken.deploy()

      const initialTokenAmount = ethers.utils.parseEther('10')
      await mockToken.approve(owner.address, ethers.constants.MaxUint256)
      await mockToken.transferFrom(owner.address, purpleFaucet.address, initialTokenAmount)

      await expect(purpleFaucet.connect(otherAccount).withdrawToken(mockToken.address)).revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('Stats', () => {
    it('should update payout stats', async () => {
      const { purpleFaucet, emptyAccount, emptyAccount2, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()

      const payoutAmount = await purpleFaucet.getPayoutAmount()
      await purpleFaucet.payout(emptyAccount.address)
      await purpleFaucet.payout(emptyAccount2.address)

      const stats = await purpleFaucet.getStats()

      expect(stats[0]).to.equal(2)
      expect(stats[1]).to.equal(payoutAmount.mul(2))
    })

    it('should update funding stats', async () => {
      const { purpleFaucet, otherAccount } = await loadFixture(deployOneYearLockFixture)

      const amount = ethers.utils.parseEther('1.1')

      await otherAccount.sendTransaction({
        to: purpleFaucet.address,
        value: amount
      })

      const tx2 = await otherAccount.sendTransaction({
        to: purpleFaucet.address,
        value: amount
      })

      const receipt = await tx2.wait()

      const event = purpleFaucet.interface.decodeEventLog('FaucetFunded', receipt.logs[0].data, receipt.logs[0].topics)
      const stats = await purpleFaucet.getStats()
      expect(stats[2]).to.equal(amount.mul(2))
      expect(event[0]).to.equal(otherAccount.address)
      expect(event[1]).to.equal(amount)
    })
  })

  describe('Pause', () => {
    it('should pause payouts', async () => {
      const { purpleFaucet, emptyAccount, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()

      await purpleFaucet.pauseWithdrawals()

      await expect(purpleFaucet.payout(emptyAccount.address)).revertedWith('Pausable: paused')
    })

    it('should resume payouts', async () => {
      const { purpleFaucet, emptyAccount, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()

      await purpleFaucet.pauseWithdrawals()
      await purpleFaucet.resumeWithdrawals()

      const tx = await purpleFaucet.payout(emptyAccount.address)
      const receipt = await tx.wait()

      expect(receipt.status).to.equal(1)
    })

    it('should pause payouts only by owner', async () => {
      const { purpleFaucet, otherAccount, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()

      await expect(purpleFaucet.connect(otherAccount).pauseWithdrawals()).revertedWith('Ownable: caller is not the owner')
    })

    it('should resume payouts only by owner', async () => {
      const { purpleFaucet, otherAccount, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()

      await expect(purpleFaucet.connect(otherAccount).resumeWithdrawals()).revertedWith('Ownable: caller is not the owner')
    })

    it('should revert pause when already paused', async () => {
      const { purpleFaucet, emptyAccount, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()

      await purpleFaucet.pauseWithdrawals()
      await expect(purpleFaucet.pauseWithdrawals()).revertedWith('Pausable: paused')
    })

    it('should revert resume when not paused', async () => {
      const { purpleFaucet, emptyAccount, fundFaucet } = await loadFixture(deployOneYearLockFixture)

      await fundFaucet()

      await expect(purpleFaucet.resumeWithdrawals()).revertedWith('Pausable: not paused')
    })
  })
})
