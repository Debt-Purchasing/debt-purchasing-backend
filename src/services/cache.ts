import cron from 'node-cron';
import { config } from '../config';
import { AssetConfiguration } from '../models/AssetConfiguration';
import { DebtPosition } from '../models/DebtPosition';
import { Order } from '../models/Order';
import { Token } from '../models/Token';
import { User } from '../models/User';
import { SubgraphAssetConfiguration, SubgraphDebtPosition, SubgraphOrder, SubgraphToken, SubgraphUser } from '../types';
import SubgraphService from './subgraph';

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
      console.log('🔄 Caching is disabled');
      return;
    }

    if (this.cronJob) {
      console.log('🔄 Caching is already running');
      return;
    }

    // Run immediately on start
    await this.fetchAndCacheData();

    // Schedule periodic caching
    const cronExpression = `*/${config.cache.intervalSeconds} * * * * *`;
    console.log(`🕒 Starting cache service with interval: ${config.cache.intervalSeconds}s`);

    this.cronJob = cron.schedule(cronExpression, async () => {
      if (!this.isRunning) {
        await this.fetchAndCacheData();
      }
    });

    console.log('✅ Cache service started successfully');
  }

  public stopCaching(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('🛑 Cache service stopped');
    }
  }

  private async fetchAndCacheData(): Promise<void> {
    if (this.isRunning) {
      console.log('⏳ Cache update already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('🔄 Starting cache update...');

      const { users, debtPositions, orders, priceTokens, liquidationThresholds } =
        await this.subgraphService.fetchAllData();

      await Promise.all([
        this.cacheUsers(users.data?.users || []),
        this.cacheDebtPositions(debtPositions.data?.debtPositions || []),
        this.cacheOrders(orders.data?.fullSaleOrderExecutions || []),
        this.cachePriceTokens(priceTokens.data?.tokens || []),
        this.cacheLiquidationThresholds(liquidationThresholds.data?.assetConfigurations || []),
      ]);

      const duration = Date.now() - startTime;
      console.log(`✅ Cache update completed in ${duration}ms`);
    } catch (error) {
      console.error('❌ Cache update failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async cacheUsers(users: SubgraphUser[]): Promise<void> {
    if (users.length === 0) return;

    try {
      const operations = users.map(user => ({
        updateOne: {
          filter: { id: user.id },
          update: {
            $set: {
              id: user.id,
              totalPositions: user.totalPositions,
              totalOrdersExecuted: user.totalOrdersExecuted,
              totalVolumeTraded: user.totalVolumeTraded,
            },
          },
          upsert: true,
        },
      }));

      const result = await User.bulkWrite(operations);
      console.log(`👥 Users cached: ${result.upsertedCount} new, ${result.modifiedCount} updated`);
    } catch (error) {
      console.error('❌ Failed to cache users:', error);
    }
  }

  private async cacheDebtPositions(positions: SubgraphDebtPosition[]): Promise<void> {
    if (positions.length === 0) return;

    try {
      const operations = positions.map(position => ({
        updateOne: {
          filter: { id: position.id },
          update: {
            $set: {
              id: position.id,
              owner: position.owner.id,
              nonce: position.nonce,
              // Transform collaterals to flatten token object
              collaterals: position.collaterals.map(collateral => ({
                id: collateral.id,
                token: collateral.token.id, // Extract token address from object
                amount: collateral.amount,
              })),
              // Transform debts to flatten token object
              debts: position.debts.map(debt => ({
                id: debt.id,
                token: debt.token.id, // Extract token address from object
                amount: debt.amount,
                interestRateMode: debt.interestRateMode,
              })),
              healthFactor: (position as any).healthFactor || '1.0', // Default health factor if not available
              lastUpdatedAt: position.lastUpdatedAt,
            },
          },
          upsert: true,
        },
      }));

      const result = await DebtPosition.bulkWrite(operations);
      console.log(`🏦 Debt positions cached: ${result.upsertedCount} new, ${result.modifiedCount} updated`);
    } catch (error) {
      console.error('❌ Failed to cache debt positions:', error);
    }
  }

  private async cacheOrders(orderExecutions: SubgraphOrder[]): Promise<void> {
    if (orderExecutions.length === 0) return;

    try {
      const operations = orderExecutions.map(execution => ({
        updateOne: {
          filter: { id: execution.id },
          update: {
            $set: {
              id: execution.id,
              position: execution.position.id,
              buyer: execution.buyer.id,
              seller: execution.seller.id,
              debtNonce: execution.debtNonce,
              executionTime: new Date(parseInt(execution.executionTime) * 1000),
              blockNumber: execution.blockNumber,
              gasUsed: execution.gasUsed,
              gasPriceGwei: execution.gasPriceGwei,
            },
          },
          upsert: true,
        },
      }));

      const result = await Order.bulkWrite(operations);
      console.log(`📋 Order executions cached: ${result.upsertedCount} new, ${result.modifiedCount} updated`);
    } catch (error) {
      console.error('❌ Failed to cache order executions:', error);
    }
  }

  private async cachePriceTokens(tokens: SubgraphToken[]): Promise<void> {
    if (tokens.length === 0) return;

    try {
      const operations = tokens.map(token => ({
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
      console.log(`💰 Price tokens cached: ${result.upsertedCount} new, ${result.modifiedCount} updated`);
    } catch (error) {
      console.error('❌ Failed to cache price tokens:', error);
    }
  }

  private async cacheLiquidationThresholds(assetConfigurations: SubgraphAssetConfiguration[]): Promise<void> {
    if (assetConfigurations.length === 0) return;

    try {
      const operations = assetConfigurations.map(config => ({
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
      console.log(`⚙️ Asset configurations cached: ${result.upsertedCount} new, ${result.modifiedCount} updated`);
    } catch (error) {
      console.error('❌ Failed to cache asset configurations:', error);
    }
  }

  public async getCachedUsers(limit = 100, offset = 0): Promise<any[]> {
    return User.find().sort({ totalVolumeTraded: -1 }).limit(limit).skip(offset).lean();
  }

  public async getCachedDebtPositions(limit = 100, offset = 0, owner?: string): Promise<any[]> {
    const filter = owner ? { owner } : {};
    return DebtPosition.find(filter).sort({ updatedAt: -1 }).limit(limit).skip(offset).lean();
  }

  public async getCachedOrders(limit = 100, offset = 0, filters?: any): Promise<any[]> {
    return Order.find(filters || {})
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();
  }

  public async getCachedPriceTokens(limit = 100, offset = 0, symbol?: string): Promise<any[]> {
    const filter = symbol ? { symbol: symbol.toUpperCase() } : {};
    return Token.find(filter).sort({ lastUpdatedAt: -1 }).limit(limit).skip(offset).lean();
  }

  public async getCachedLiquidationThresholds(
    limit = 100,
    offset = 0,
    symbol?: string,
    isActive?: boolean,
  ): Promise<any[]> {
    const filter: any = {};
    if (symbol) filter.symbol = symbol.toUpperCase();
    if (isActive !== undefined) filter.isActive = isActive;
    return AssetConfiguration.find(filter).sort({ lastUpdatedAt: -1 }).limit(limit).skip(offset).lean();
  }

  public async getStats(): Promise<any> {
    const [userCount, positionCount, orderCount, tokenCount, assetConfigCount] = await Promise.all([
      User.countDocuments(),
      DebtPosition.countDocuments(),
      Order.countDocuments(),
      Token.countDocuments(),
      AssetConfiguration.countDocuments(),
    ]);

    return {
      users: userCount,
      positions: positionCount,
      orders: orderCount,
      tokens: tokenCount,
      assetConfigurations: assetConfigCount,
      lastUpdate: new Date().toISOString(),
      cacheEnabled: config.cache.enabled,
      intervalSeconds: config.cache.intervalSeconds,
    };
  }
}

export default SubgraphCacheService;
