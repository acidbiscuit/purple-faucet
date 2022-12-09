import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import "@nomicfoundation/hardhat-chai-matchers";
import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import 'solidity-coverage'
import 'hardhat-contract-sizer'

import dotenv from 'dotenv'

dotenv.config()

const config: HardhatUserConfig = {
  solidity: '0.8.17',

  networks: {
    hardhat: {
      chainId: 1337
    },
    mumbai: {
      url: process.env.MUMBAI_RPC_URL || 'https://rpc-mumbai.matic.today',
      accounts: [process.env.OWNER_MNEMONIC as string]
    },
    polygon:{
      url: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      accounts: [process.env.OWNER_MNEMONIC as string]
    }
  },

  namedAccounts: {
  },

  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY as string
  }
}

export default config
