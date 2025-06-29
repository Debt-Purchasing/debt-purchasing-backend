import crypto from "crypto";
import { ethers } from "ethers";
import { IFullSellOrder, IPartialSellOrder } from "../models/Order";

// Type hashes from the contract (must match exactly)
// Note: These are simplified hashes - in production, use proper keccak256 from ethers
export const FULL_SELL_ORDER_TYPE_HASH = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(
    "FullSellOrder(uint256 chainId,address contract,OrderTitle title,address token,uint256 percentOfEquity)"
  )
);

export const PARTIAL_SELL_ORDER_TYPE_HASH = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(
    "PartialSellOrder(uint256 chainId,address contract,OrderTitle title,uint256 interestRateMode,address[] collateralOut,uint256[] percents,address repayToken,uint256 repayAmount,uint256 bonus)"
  )
);

export const ORDER_TITLE_TYPE_HASH = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(
    "OrderTitle(address debt,uint256 debtNonce,uint256 startTime,uint256 endTime,uint256 triggerHF)"
  )
);

// EIP-712 Domain Separator
export const DOMAIN_TYPE_HASH = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
  )
);

// EIP-712 Domain data
export const DOMAIN_NAME = "AaveRouter";
export const DOMAIN_VERSION = "1";

/**
 * Generate unique order ID
 */
export function generateOrderId(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Create EIP-712 Domain Separator
 */
export function createDomainSeparator(
  chainId: number,
  contractAddress: string
): string {
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        DOMAIN_TYPE_HASH,
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(DOMAIN_NAME)),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(DOMAIN_VERSION)),
        chainId,
        contractAddress,
      ]
    )
  );
}

/**
 * Create EIP-712 compatible signature for FullSellOrder
 * This produces the same result as the raw hash method but uses EIP-712 structure
 */
export function createEIP712FullSellOrderHash(
  chainId: number,
  contractAddress: string,
  order: IFullSellOrder
): string {
  // Create domain separator
  const domainSeparator = createDomainSeparator(chainId, contractAddress);

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

  // Create struct hash
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

  // Create EIP-712 digest
  return ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ["string", "bytes32", "bytes32"],
      ["\x19\x01", domainSeparator, structHash]
    )
  );
}

/**
 * Create EIP-712 compatible signature for PartialSellOrder
 * This produces the same result as the raw hash method but uses EIP-712 structure
 */
export function createEIP712PartialSellOrderHash(
  chainId: number,
  contractAddress: string,
  order: IPartialSellOrder
): string {
  // Create domain separator
  const domainSeparator = createDomainSeparator(chainId, contractAddress);

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

  // Create struct hash
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

  // Create EIP-712 digest
  return ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ["string", "bytes32", "bytes32"],
      ["\x19\x01", domainSeparator, structHash]
    )
  );
}

/**
 * Verify EIP-712 signature for FullSellOrder
 * This should produce the same verification result as the raw hash method
 */
export function verifyEIP712FullSellOrderSignature(
  chainId: number,
  contractAddress: string,
  order: IFullSellOrder,
  expectedSigner: string
): boolean {
  try {
    // Create EIP-712 hash
    const eip712Hash = createEIP712FullSellOrderHash(
      chainId,
      contractAddress,
      order
    );

    // Create signature object
    const signature = {
      v: order.v,
      r: order.r,
      s: order.s,
    };

<<<<<<< HEAD
    // Use raw hash recovery (matching contract's ECDSA.recover expectation - no message prefix)
    const recoveredAddress = ethers.utils.recoverAddress(structHash, signature);
=======
    // Recover address from EIP-712 hash
    const recoveredAddress = ethers.utils.recoverAddress(eip712Hash, signature);
>>>>>>> 8a29508 (fix verify signature)
    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch (error) {
    return false;
  }
}

/**
 * Verify EIP-712 signature for PartialSellOrder
 * This should produce the same verification result as the raw hash method
 */
export function verifyEIP712PartialSellOrderSignature(
  chainId: number,
  contractAddress: string,
  order: IPartialSellOrder,
  expectedSigner: string
): boolean {
  try {
    // Create EIP-712 hash
    const eip712Hash = createEIP712PartialSellOrderHash(
      chainId,
      contractAddress,
      order
    );

    // Create signature object
    const signature = {
      v: order.v,
      r: order.r,
      s: order.s,
    };

<<<<<<< HEAD
    // Use raw hash recovery (matching contract's ECDSA.recover expectation - no message prefix)
    const recoveredAddress = ethers.utils.recoverAddress(structHash, signature);
=======
    // Recover address from EIP-712 hash
    const recoveredAddress = ethers.utils.recoverAddress(eip712Hash, signature);
>>>>>>> 8a29508 (fix verify signature)
    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch (error) {
    return false;
  }
}

/**
 * Validate order timing for flattened order structure
 */
export function validateOrderTiming(
  order: IFullSellOrder | IPartialSellOrder
): { valid: boolean; reason?: string } {
  const now = Math.floor(Date.now() / 1000);

  if (order.startTime > order.endTime) {
    return { valid: false, reason: "Start time must be before end time" };
  }

  if (order.endTime <= now) {
    return { valid: false, reason: "Order has already expired" };
  }

  if (order.startTime < now - 3600) {
    // Allow 1 hour in the past
    return { valid: false, reason: "Start time too far in the past" };
  }

  return { valid: true };
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return ethers.utils.isAddress(address);
}

/**
 * Validate percentage values (should be between 0 and 10000 for basis points)
 */
export function validatePercentage(
  percentage: string,
  allowZero = false
): boolean {
  try {
    const num = BigInt(percentage);
    if (!allowZero && num === BigInt(0)) return false;
    return num >= 0 && num <= BigInt(10000); // 10000 = 100%
  } catch {
    return false;
  }
}

/**
 * Validate array of percentages sum to 100%
 */
export function validatePercentagesSum(percentages: string[]): boolean {
  try {
    const sum = percentages.reduce((acc, p) => acc + BigInt(p), BigInt(0));
    return sum === BigInt(10000); // Must sum to 100%
  } catch {
    return false;
  }
}

/**
 * Validate BigNumber string format
 */
export function isValidBigNumberString(value: string): boolean {
  return /^\d+$/.test(value) && value !== "";
}

/**
 * Validate full sell order structure
 */
export function validateFullSellOrder(order: IFullSellOrder): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate addresses
  if (!isValidAddress(order.debt)) {
    errors.push("Invalid debt address");
  }
  if (!isValidAddress(order.token)) {
    errors.push("Invalid token address");
  }

  // Validate timing
  const timingResult = validateOrderTiming(order);
  if (!timingResult.valid) {
    errors.push(timingResult.reason!);
  }

  // Validate numeric values
  if (!isValidBigNumberString(order.triggerHF)) {
    errors.push("Invalid trigger health factor");
  }
  if (!validatePercentage(order.percentOfEquity)) {
    errors.push("Invalid percent of equity (must be 1-10000)");
  }

  // Validate signature components
  if (order.v < 27 || order.v > 28) {
    errors.push("Invalid signature v value");
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(order.r)) {
    errors.push("Invalid signature r component");
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(order.s)) {
    errors.push("Invalid signature s component");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate partial sell order structure
 */
export function validatePartialSellOrder(order: IPartialSellOrder): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate addresses
  if (!isValidAddress(order.debt)) {
    errors.push("Invalid debt address");
  }
  if (!isValidAddress(order.repayToken)) {
    errors.push("Invalid repay token address");
  }

  // Validate collateral addresses
  if (order.collateralOut.length === 0) {
    errors.push("Must specify at least one collateral token");
  }
  for (const collateral of order.collateralOut) {
    if (!isValidAddress(collateral)) {
      errors.push(`Invalid collateral address: ${collateral}`);
    }
  }

  // Validate percentages
  if (order.percents.length !== order.collateralOut.length) {
    errors.push(
      "Collateral tokens and percentages arrays must have same length"
    );
  }
  if (!validatePercentagesSum(order.percents)) {
    errors.push("Percentages must sum to 10000 (100%)");
  }
  for (const percent of order.percents) {
    if (!validatePercentage(percent)) {
      errors.push(`Invalid percentage value: ${percent}`);
    }
  }

  // Validate timing
  const timingResult = validateOrderTiming(order);
  if (!timingResult.valid) {
    errors.push(timingResult.reason!);
  }

  // Validate numeric values
  if (!isValidBigNumberString(order.triggerHF)) {
    errors.push("Invalid trigger health factor");
  }
  if (!isValidBigNumberString(order.repayAmount)) {
    errors.push("Invalid repay amount");
  }
  if (!validatePercentage(order.bonus, true)) {
    errors.push("Invalid bonus percentage");
  }

  // Validate interest rate mode
  if (![1, 2].includes(order.interestRateMode)) {
    errors.push("Interest rate mode must be 1 (stable) or 2 (variable)");
  }

  // Validate signature components
  if (order.v < 27 || order.v > 28) {
    errors.push("Invalid signature v value");
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(order.r)) {
    errors.push("Invalid signature r component");
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(order.s)) {
    errors.push("Invalid signature s component");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if order can be executed (timing, status, and health factor)
 * @param startTime Order start time
 * @param endTime Order end time
 * @param status Order status
 * @param triggerHF Order's trigger health factor (as string representing BigNumber)
 * @param currentHF Current health factor of the debt position (as string representing BigNumber)
 * @returns "YES" if executable, or "NO - reason" if not executable
 */
export function canExecuteOrder(
  startTime: Date,
  endTime: Date,
  status: string,
  triggerHF: string,
  currentHF: string
): string {
  const now = new Date();

  // Check if order is active
  if (status !== "ACTIVE") {
    return "NO - non active";
  }

  // Check if order has expired
  if (now > endTime) {
    return "NO - expired";
  }

  // Check if order hasn't started yet (technically not expired, but not executable)
  if (now < startTime) {
    return "NO - not started";
  }

  // Check Health Factor - HF must be <= triggerHF to execute
  try {
    const triggerHFBig = BigInt(triggerHF);
    const currentHFBig = BigInt(currentHF);

    if (currentHFBig > triggerHFBig) {
      return "NO - HF too high";
    }
  } catch (error) {
    // Invalid BigNumber format
    return "NO - invalid HF format";
  }

  return "YES";
}

/**
 * Convert timestamp to Date object
 */
export function timestampToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

/**
 * Convert Date to timestamp
 */
export function dateToTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Calculate real-time Health Factor using the Aave V3 formula:
 * HF = Σ(collateral_i × price_i × liquidationThreshold_i) / Σ(debt_i × price_i)
 */
export async function calculateHealthFactor(
  collaterals: Array<{ token: string; amount: string }>,
  debts: Array<{ token: string; amount: string }>
): Promise<string> {
  try {
    // Import models here to avoid circular dependency
    const { Token } = await import("../models/Token");
    const { AssetConfiguration } = await import("../models/AssetConfiguration");

    if (debts.length === 0) {
      return "999999000000000000000000"; // Very high HF when no debt (999,999 * 1e18)
    }

    // Get all unique token addresses
    const allTokens = [
      ...collaterals.map((c) => c.token),
      ...debts.map((d) => d.token),
    ];
    const uniqueTokens = [...new Set(allTokens)];

    // Fetch token prices and asset configurations
    const [tokens, assetConfigs] = await Promise.all([
      Token.find({ id: { $in: uniqueTokens } }).lean(),
      AssetConfiguration.find({
        id: { $in: uniqueTokens },
        isActive: true,
      }).lean(),
    ]);

    // Create lookup maps
    const tokenPriceMap = new Map<
      string,
      { priceUSD: string; decimals: number }
    >();
    const liquidationThresholdMap = new Map<string, string>();

    tokens.forEach((token) => {
      tokenPriceMap.set(token.id, {
        priceUSD: token.priceUSD,
        decimals: token.decimals,
      });
    });

    assetConfigs.forEach((config) => {
      liquidationThresholdMap.set(config.id, config.liquidationThreshold);
    });

    // Calculate weighted collateral value
    let totalWeightedCollateralValue = 0;

    for (const collateral of collaterals) {
      let tokenData = tokenPriceMap.get(collateral.token);
      let liquidationThreshold = liquidationThresholdMap.get(collateral.token);

      if (!tokenData || !liquidationThreshold) {
        if (!tokenData) {
          tokenData = { priceUSD: "1.00", decimals: 18 };
        }
        if (!liquidationThreshold) {
          liquidationThreshold = "0.85";
        }
      }

      // All values are human-readable: amount=10, price=1.00, threshold=0.85
      const amount = parseFloat(collateral.amount);
      const price = parseFloat(tokenData.priceUSD);
      const threshold = parseFloat(liquidationThreshold);

      // Simple calculation: 10 USDC * $1.00 * 0.85 = $8.50
      const weightedValue = amount * price * threshold;

      totalWeightedCollateralValue += weightedValue;
    }

    // Calculate total debt value
    let totalDebtValue = 0;

    for (const debt of debts) {
      let tokenData = tokenPriceMap.get(debt.token);

      if (!tokenData) {
        tokenData = { priceUSD: "1.00", decimals: 18 };
      }

      // All values are human-readable: amount=1, price=1.00
      const amount = parseFloat(debt.amount);
      const price = parseFloat(tokenData.priceUSD);

      // Simple calculation: 1 DAI * $1.00 = $1.00
      const debtValue = amount * price;

      totalDebtValue += debtValue;
    }

    // Calculate Health Factor: HF = totalWeightedCollateralValue / totalDebtValue
    // Multiply by 1e18 to maintain precision (standard for HF representation)
    if (totalDebtValue === 0) {
      return "999999000000000000000000"; // Very high HF when no debt
    }

    const healthFactor = totalWeightedCollateralValue / totalDebtValue;
    const healthFactorBig = BigInt(Math.floor(healthFactor * 1e18));

    return healthFactorBig.toString();
  } catch (error) {
    return "999999000000000000000000"; // Very high HF when no debt (999,999 * 1e18)
  }
}
