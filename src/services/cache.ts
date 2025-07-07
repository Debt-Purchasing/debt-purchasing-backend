import cron from "node-cron";
import { config } from "../config";
import { AssetConfiguration } from "../models/AssetConfiguration";
import { DebtPosition } from "../models/DebtPosition";
import { Order } from "../models/Order"; // Orders (both pending and executed)
import { Token } from "../models/Token";
import { User } from "../models/User";
import {
  SubgraphAssetConfiguration,
  SubgraphDebtPosition,
  SubgraphFullOrder,
  SubgraphPartialOrder,
  SubgraphToken,
  SubgraphUser,
} from "../types";
import SubgraphService from "./subgraph";

export class SubgraphCacheService {
  private static instance: SubgraphCacheService;
  private subgraphService: SubgraphService;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  private constructor() {
    this.subgraphService = SubgraphService.getInstance();
  }

  public static getInstance(): SubgraphCacheService {
    if (!SubgraphCacheService.instance) {
      SubgraphCacheService.instance = new SubgraphCacheService();
    }
    return SubgraphCacheService.instance;
  }

  public async startCaching(): Promise<void> {
    if (!config.cache.enabled) {
      console.log("🔄 Caching is disabled");
      return;
    }

    if (this.cronJob) {
      console.log("🔄 Caching is already running");
      return;
    }

    // Run immediately on start
    await this.fetchAndCacheData();

    // Schedule periodic caching
    const cronExpression = `*/${config.cache.intervalSeconds} * * * * *`;
    console.log(
      `🕒 Starting cache service with interval: ${config.cache.intervalSeconds}s`
    );

    this.cronJob = cron.schedule(cronExpression, async () => {
      if (!this.isRunning) {
        await this.fetchAndCacheData();
      }
    });

    console.log("✅ Cache service started successfully");
  }

  public stopCaching(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log("🛑 Cache service stopped");
    }
  }

  public async forceRefresh(): Promise<void> {
    console.log("🔄 Force refresh triggered");
    await this.fetchAndCacheData();
  }

  private async fetchAndCacheData(): Promise<void> {
    if (this.isRunning) {
      console.log("⏳ Cache update already in progress, skipping...");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log("🔄 Starting cache update...");

      const {
        users,
        debtPositions,
        fullOrderExecutions,
        partialOrderExecutions,
        priceTokens,
        liquidationThresholds,
      } = await this.subgraphService.fetchAllData();

      await Promise.all([
        this.cacheUsers(users.data?.users || []),
        this.cacheDebtPositions(debtPositions.data?.debtPositions || []),
        this.cacheFullOrders(
          fullOrderExecutions.data?.fullOrderExecutions || []
        ),
        this.cachePartialOrders(
          partialOrderExecutions.data?.partialOrderExecutions || []
        ),
        this.cachePriceTokens(priceTokens.data?.tokens || []),
        this.cacheLiquidationThresholds(
          liquidationThresholds.data?.assetConfigurations || []
        ),
      ]);

      const duration = Date.now() - startTime;
      console.log(`✅ Cache update completed in ${duration}ms`);
    } catch (error) {
      console.error("❌ Cache update failed:", error);
    } finally {
      this.isRunning = false;
    }
  }

  private async cacheUsers(users: SubgraphUser[]): Promise<void> {
    try {
      const operations = users.map((user) => ({
        updateOne: {
          filter: { id: user.id },
          update: {
            $set: {
              id: user.id,
              nonce: user.nonce,
              totalPositions: user.totalPositions,
              totalOrdersExecuted: user.totalOrdersExecuted,
              totalVolumeUSD: user.totalVolumeUSD,
              lastUpdatedAt: user.lastUpdatedAt,
            },
          },
          upsert: true,
        },
      }));

      const result = await User.bulkWrite(operations);
      console.log(
        `👥 Users cached: ${result.upsertedCount} new, ${result.modifiedCount} updated`
      );
    } catch (error) {
      console.error("❌ Failed to cache users:", error);
    }
  }

  private async cacheDebtPositions(
    positions: SubgraphDebtPosition[]
  ): Promise<void> {
    if (positions.length === 0) return;

    try {
      const operations = positions.map((position) => ({
        updateOne: {
          filter: { id: position.id },
          update: {
            $set: {
              id: position.id,
              owner: position.owner,
              nonce: position.nonce,
              // Transform collaterals to flatten token object
              collaterals: position.collaterals.map((collateral) => ({
                id: collateral.id,
                token: collateral.token.id, // Extract token address from object
                symbol: collateral.token.symbol,
                decimals: collateral.token.decimals,
                amount: collateral.amount,
              })),
              // Transform debts to flatten token object
              debts: position.debts.map((debt) => ({
                id: debt.id,
                token: debt.token.id, // Extract token address from object
                symbol: debt.token.symbol,
                decimals: debt.token.decimals,
                amount: debt.amount,
                interestRateMode: debt.interestRateMode,
              })),
              createdAt: position.createdAt,
              lastUpdatedAt: position.lastUpdatedAt,
            },
          },
          upsert: true,
        },
      }));

      const result = await DebtPosition.bulkWrite(operations);
      console.log(
        `🏦 Debt positions cached: ${result.upsertedCount} new, ${result.modifiedCount} updated`
      );

      // Cancel orders with old nonce for each updated debt position
      for (const position of positions) {
        await this.cancelOldOrdersForDebtPosition(
          position.id,
          parseInt(position.nonce)
        );
      }
    } catch (error) {
      console.error("❌ Failed to cache debt positions:", error);
    }
  }

  private async cacheFullOrders(
    orderExecutions: SubgraphFullOrder[]
  ): Promise<void> {
    if (orderExecutions.length === 0) return;

    try {
      // Process each order execution to update debt positions and cancel old orders
      for (const execution of orderExecutions) {
        await this.processFullOrderExecution(execution);
      }
    } catch (error) {
      console.error("❌ Failed to process order executions:", error);
    }
  }

  private async cachePartialOrders(
    orderExecutions: SubgraphPartialOrder[]
  ): Promise<void> {
    if (orderExecutions.length === 0) return;

    try {
      // Process each order execution to update debt positions and cancel old orders
      for (const execution of orderExecutions) {
        await this.processPartialOrderExecution(execution);
      }
    } catch (error) {
      console.error("❌ Failed to process order executions:", error);
    }
  }

  /**
   * Process order execution to:
   * 1. Update debt position nonce
   * 2. Cancel all orders with lower nonce
   * 3. Mark executed order as EXECUTED if found
   */
  private async processFullOrderExecution(
    execution: SubgraphFullOrder
  ): Promise<void> {
    try {
      const order = await Order.findOne({
        titleHash: execution.titleHash,
        orderType: "FULL",
      });
      const debtPositionId = order?.debtAddress || "";
      const newNonce = (order?.debtNonce || 0) + 1;
      const executionTime = new Date(parseInt(execution.blockTimestamp) * 1000);

      console.log(
        `🔄 Processing order execution for debt ${debtPositionId}, new nonce: ${newNonce}`
      );

      await DebtPosition.updateOne(
        { id: debtPositionId },
        {
          $set: {
            nonce: newNonce,
            owner: execution.buyer,
            lastUpdatedAt: executionTime,
          },
        }
      );

      await Order.updateOne(
        { id: execution.titleHash, orderType: "FULL" },
        {
          $set: {
            status: "EXECUTED",
            buyer: execution.buyer,
            blockNumber: execution.blockNumber,
            txHash: execution.id,
            updatedAt: executionTime,
          },
        }
      );
    } catch (error) {
      console.error(
        `❌ Failed to process order execution for ${execution.titleHash}:`,
        error
      );
    }
  }

  private async processPartialOrderExecution(
    execution: SubgraphPartialOrder
  ): Promise<void> {
    try {
      const order = await Order.findOne({
        titleHash: execution.titleHash,
        orderType: "PARTIAL",
      });
      const debtPositionId = order?.debtAddress || "";
      const newNonce = (order?.debtNonce || 0) + 1;
      const executionTime = new Date(parseInt(execution.blockTimestamp) * 1000);

      await DebtPosition.updateOne(
        { id: debtPositionId },
        {
          $set: {
            nonce: newNonce,
            lastUpdatedAt: executionTime,
          },
        }
      );

      await Order.updateOne(
        { titleHash: execution.titleHash, orderType: "PARTIAL" },
        {
          $set: {
            status: "EXECUTED",
            buyer: execution.buyer,
            blockNumber: execution.blockNumber,
            txHash: execution.id,
            updatedAt: executionTime,
          },
        }
      );
    } catch (error) {
      console.error(
        `❌ Failed to process order execution for ${execution.titleHash}:`,
        error
      );
    }
  }

  /**
   * Cancel orders with old nonce when debt position nonce is updated
   */
  private async cancelOldOrdersForDebtPosition(
    debtPositionId: string,
    currentNonce: number
  ): Promise<void> {
    try {
      // Cancel all active orders with nonce less than current nonce
      const cancelResult = await Order.updateMany(
        {
          debtAddress: debtPositionId,
          debtNonce: { $lt: currentNonce },
          status: "ACTIVE",
        },
        {
          $set: {
            status: "CANCELLED",
            updatedAt: new Date(),
          },
        }
      );

      if (cancelResult.modifiedCount > 0) {
        console.log(
          `🚫 Cancelled ${cancelResult.modifiedCount} orders for debt ${debtPositionId} with nonce < ${currentNonce}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Failed to cancel old orders for debt ${debtPositionId}:`,
        error
      );
    }
  }

  private async cachePriceTokens(tokens: SubgraphToken[]): Promise<void> {
    if (tokens.length === 0) return;

    try {
      const operations = tokens.map((token) => ({
        updateOne: {
          filter: { id: token.id },
          update: {
            $set: {
              id: token.id,
              symbol: token.symbol,
              decimals: token.decimals,
              priceUSD: token.priceUSD,
              oracleSource: token.oracleSource,
              lastUpdatedAt: token.lastUpdatedAt,
            },
          },
          upsert: true,
        },
      }));

      const result = await Token.bulkWrite(operations);
      console.log(
        `💰 Price tokens cached: ${result.upsertedCount} new, ${result.modifiedCount} updated`
      );
    } catch (error) {
      console.error("❌ Failed to cache price tokens:", error);
    }
  }

  private async cacheLiquidationThresholds(
    assetConfigurations: SubgraphAssetConfiguration[]
  ): Promise<void> {
    if (assetConfigurations.length === 0) return;

    try {
      const operations = assetConfigurations.map((config) => ({
        updateOne: {
          filter: { id: config.id },
          update: {
            $set: {
              id: config.id,
              symbol: config.symbol,
              liquidationThreshold: config.liquidationThreshold,
              liquidationBonus: config.liquidationBonus,
              reserveFactor: config.reserveFactor,
              isActive: config.isActive,
              lastUpdatedAt: config.lastUpdatedAt,
            },
          },
          upsert: true,
        },
      }));

      const result = await AssetConfiguration.bulkWrite(operations);
      console.log(
        `⚙️ Asset configurations cached: ${result.upsertedCount} new, ${result.modifiedCount} updated`
      );
    } catch (error) {
      console.error("❌ Failed to cache asset configurations:", error);
    }
  }

  public async getCachedUsers(limit = 100, offset = 0): Promise<any[]> {
    return User.find()
      .sort({ totalVolumeUSD: -1 })
      .limit(limit)
      .skip(offset)
      .lean();
  }

  public async getCachedDebtPositions(
    limit = 100,
    offset = 0,
    owner?: string
  ): Promise<{ positions: any[]; total: number }> {
    const filter = owner ? { owner } : {};
    const [positions, total] = await Promise.all([
      DebtPosition.find(filter)
        .sort({ updatedAt: -1 })
        .limit(limit)
        .skip(offset)
        .lean(),
      DebtPosition.countDocuments(filter),
    ]);
    return { positions, total };
  }

  public async getCachedOrders(
    limit = 100,
    offset = 0,
    filters?: any
  ): Promise<any[]> {
    // Return executed orders (status = EXECUTED)
    return Order.find({ status: "EXECUTED", ...filters })
      .sort({ executedAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();
  }

  public async getCachedPriceTokens(
    limit = 100,
    offset = 0,
    symbol?: string
  ): Promise<any[]> {
    const filter = symbol ? { symbol: symbol.toUpperCase() } : {};
    return Token.find(filter)
      .sort({ lastUpdatedAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();
  }

  public async getCachedLiquidationThresholds(
    limit = 100,
    offset = 0,
    symbol?: string,
    isActive?: boolean
  ): Promise<any[]> {
    const filter: any = {};
    if (symbol) filter.symbol = symbol.toUpperCase();
    if (isActive !== undefined) filter.isActive = isActive;
    return AssetConfiguration.find(filter)
      .sort({ lastUpdatedAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();
  }

  public async getStats(): Promise<any> {
    const [
      userCount,
      positionCount,
      executedOrderCount,
      pendingOrderCount,
      tokenCount,
      assetConfigCount,
    ] = await Promise.all([
      User.countDocuments(),
      DebtPosition.countDocuments(),
      Order.countDocuments({ status: "EXECUTED" }),
      Order.countDocuments({ status: "ACTIVE" }),
      Token.countDocuments(),
      AssetConfiguration.countDocuments(),
    ]);

    return {
      users: userCount,
      positions: positionCount,
      executedOrders: executedOrderCount, // Orders that have been executed
      pendingOrders: pendingOrderCount, // Orders waiting to be executed
      tokens: tokenCount,
      assetConfigurations: assetConfigCount,
      lastUpdate: new Date().toISOString(),
      cacheEnabled: config.cache.enabled,
      intervalSeconds: config.cache.intervalSeconds,
    };
  }
}

export default SubgraphCacheService;
