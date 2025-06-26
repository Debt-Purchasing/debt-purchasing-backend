import { ethers } from "ethers";

// Test constants
export const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const TEST_WALLET = new ethers.Wallet(TEST_PRIVATE_KEY);
export const TEST_ADDRESS = TEST_WALLET.address;
export const TEST_CHAIN_ID = 1337;
export const TEST_CONTRACT_ADDRESS =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Test token addresses - using real mainnet contract addresses that pass checksum validation
export const USDC_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7"; // Real USDT mainnet
export const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
export const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

// Helper to create valid order data
export function createValidFullSellOrder() {
  const now = Math.floor(Date.now() / 1000);
  return {
    debt: "0x1234567890123456789012345678901234567890",
    debtNonce: 0,
    startTime: now,
    endTime: now + 3600, // 1 hour from now
    triggerHF: "1500000000000000000", // 1.5 HF
    token: USDT_ADDRESS,
    percentOfEquity: "5000", // 50%
    v: 27,
    r: "0x" + "0".repeat(64),
    s: "0x" + "0".repeat(64),
  };
}

export function createValidPartialSellOrder() {
  const now = Math.floor(Date.now() / 1000);
  return {
    debt: "0x1234567890123456789012345678901234567890",
    debtNonce: 0,
    startTime: now,
    endTime: now + 3600,
    triggerHF: "1500000000000000000",
    interestRateMode: 2,
    collateralOut: [USDT_ADDRESS],
    percents: ["10000"], // 100%
    repayToken: DAI_ADDRESS,
    repayAmount: "1000000000000000000", // 1 token
    bonus: "500", // 5%
    v: 27,
    r: "0x" + "0".repeat(64),
    s: "0x" + "0".repeat(64),
  };
}

// Generate signature for full sell order (matching contract logic)
export async function signFullSellOrder(
  chainId: number,
  contractAddress: string,
  order: any,
  wallet: ethers.Wallet
) {
  // Create type hashes (same as contract)
  const FULL_SELL_ORDER_TYPE_HASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(
      "FullSellOrder(uint256 chainId,address contract,OrderTitle title,address token,uint256 percentOfEquity)"
    )
  );

  const ORDER_TITLE_TYPE_HASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(
      "OrderTitle(address debt,uint256 debtNonce,uint256 startTime,uint256 endTime,uint256 triggerHF)"
    )
  );

  // Create title hash
  const titleHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "uint256", "uint256", "uint256", "uint256"],
      [
        ORDER_TITLE_TYPE_HASH,
        order.debt,
        order.debtNonce,
        order.startTime,
        order.endTime,
        order.triggerHF,
      ]
    )
  );

  // Create struct hash (same as contract logic)
  const structHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint256", "address", "bytes32", "address", "uint256"],
      [
        FULL_SELL_ORDER_TYPE_HASH,
        chainId,
        contractAddress,
        titleHash,
        order.token,
        order.percentOfEquity,
      ]
    )
  );

  // Sign the struct hash directly (not EIP-712)
  const signature = wallet._signingKey().signDigest(structHash);
  const { v, r, s } = signature;

  return { v, r, s };
}

// Generate signature for partial sell order (matching contract logic)
export async function signPartialSellOrder(
  chainId: number,
  contractAddress: string,
  order: any,
  wallet: ethers.Wallet
) {
  // Create type hashes (same as contract)
  const PARTIAL_SELL_ORDER_TYPE_HASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(
      "PartialSellOrder(uint256 chainId,address contract,OrderTitle title,uint256 interestRateMode,address[] collateralOut,uint256[] percents,address repayToken,uint256 repayAmount,uint256 bonus)"
    )
  );

  const ORDER_TITLE_TYPE_HASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(
      "OrderTitle(address debt,uint256 debtNonce,uint256 startTime,uint256 endTime,uint256 triggerHF)"
    )
  );

  // Create title hash
  const titleHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "uint256", "uint256", "uint256", "uint256"],
      [
        ORDER_TITLE_TYPE_HASH,
        order.debt,
        order.debtNonce,
        order.startTime,
        order.endTime,
        order.triggerHF,
      ]
    )
  );

  // Create struct hash (same as contract logic)
  const structHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      [
        "bytes32",
        "uint256",
        "address",
        "bytes32",
        "uint256",
        "address[]",
        "uint256[]",
        "address",
        "uint256",
        "uint256",
      ],
      [
        PARTIAL_SELL_ORDER_TYPE_HASH,
        chainId,
        contractAddress,
        titleHash,
        order.interestRateMode,
        order.collateralOut,
        order.percents,
        order.repayToken,
        order.repayAmount,
        order.bonus,
      ]
    )
  );

  // Sign the struct hash directly (not EIP-712)
  const signature = wallet._signingKey().signDigest(structHash);
  const { v, r, s } = signature;

  return { v, r, s };
}
