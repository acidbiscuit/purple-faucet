import { ethers } from "hardhat";

async function main() {
  const PurpleFaucet = await ethers.getContractFactory('PurpleFaucet')
  const purpleFaucet = await PurpleFaucet.deploy()

  await purpleFaucet.deployed()

  console.log('Deployed')
  console.log('PurpleFaucet:', purpleFaucet.address)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
