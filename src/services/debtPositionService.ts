import { DebtPosition } from '../models/DebtPosition';
import { calculateHealthFactor } from '../utils/orderHelpers';
import SubgraphCacheService from './cache';

export interface DebtPositionWithHealthFactor {
  id: string;
  owner: string;
  collaterals: Array<{
    id: string;
    token: string;
    amount: string;
  }>;
  debts: Array<{
    id: string;
    token: string;
    amount: string;
    interestRateMode: string;
  }>;
  healthFactor: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebtPositionsResponse {
  positions: DebtPositionWithHealthFactor[];
  total?: number;
}

class DebtPositionService {
  private static instance: DebtPositionService;

  public static getInstance(): DebtPositionService {
    if (!DebtPositionService.instance) {
      DebtPositionService.instance = new DebtPositionService();
    }
    return DebtPositionService.instance;
  }

  /**
   * Get a single debt position with real-time health factor by address
   */
  async getDebtPositionWithHealthFactor(address: string): Promise<DebtPositionWithHealthFactor | null> {
    try {
      // Query directly by debt position ID instead of using the cache service's owner filter
      const debtPosition = await DebtPosition.findOne({ id: address }).lean();

      if (!debtPosition) {
        return null;
      }

      // Calculate real-time health factor
      const healthFactor = await this.calculateHealthFactorSafely(debtPosition.collaterals, debtPosition.debts);

      return {
        id: debtPosition.id,
        owner: debtPosition.owner,
        collaterals: debtPosition.collaterals,
        debts: debtPosition.debts,
        healthFactor,
        createdAt: debtPosition.createdAt ? new Date(debtPosition.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: debtPosition.updatedAt ? new Date(debtPosition.updatedAt).toISOString() : new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error getting debt position ${address}:`, error);
      return null;
    }
  }

  /**
   * Get multiple debt positions with real-time health factors
   */
  async getDebtPositionsWithHealthFactor(
    limit: number = 100,
    offset: number = 0,
    owner?: string,
  ): Promise<DebtPositionsResponse> {
    try {
      const cacheService = SubgraphCacheService.getInstance();
      const { positions, total } = await cacheService.getCachedDebtPositions(limit, offset, owner);

      // Calculate real-time health factor for each position
      const positionsWithHealthFactor = await Promise.all(
        positions.map(async position => {
          const healthFactor = await this.calculateHealthFactorSafely(position.collaterals, position.debts);

          return {
            ...position,
            healthFactor,
          } as DebtPositionWithHealthFactor;
        }),
      );

      return {
        positions: positionsWithHealthFactor,
        total,
      };
    } catch (error) {
      console.error('Error getting debt positions:', error);
      return {
        positions: [],
        total: 0,
      };
    }
  }

  /**
   * Get debt position data specifically for order responses
   * This includes additional metadata that might be useful for orders
   */
  async getDebtPositionForOrder(debtAddress: string): Promise<DebtPositionWithHealthFactor | null> {
    try {
      // First try to get from cache (faster)
      const cachedPosition = await this.getDebtPositionWithHealthFactor(debtAddress);

      if (cachedPosition) {
        return cachedPosition;
      }

      // If not in cache, try to get from database directly
      const debtPosition = await DebtPosition.findOne({ id: debtAddress }).lean();

      if (!debtPosition) {
        return null;
      }

      const healthFactor = await this.calculateHealthFactorSafely(debtPosition.collaterals, debtPosition.debts);

      return {
        id: debtPosition.id,
        owner: debtPosition.owner,
        collaterals: debtPosition.collaterals,
        debts: debtPosition.debts,
        healthFactor,
        createdAt: debtPosition.createdAt ? new Date(debtPosition.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: debtPosition.updatedAt ? new Date(debtPosition.updatedAt).toISOString() : new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error getting debt position for order ${debtAddress}:`, error);
      return null;
    }
  }

  /**
   * Get current health factor for a debt address (used by orderRoutes)
   */
  async getCurrentHealthFactor(debtAddress: string): Promise<string> {
    try {
      const debtPosition = await DebtPosition.findOne({ id: debtAddress }).lean();

      if (!debtPosition) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`Debt position not found: ${debtAddress}`);
        }
        return '1000000000000000000'; // Default 1.0 HF
      }

      return await this.calculateHealthFactorSafely(debtPosition.collaterals, debtPosition.debts);
    } catch (error) {
      console.error(`Error getting current HF for ${debtAddress}:`, error);
      return '1000000000000000000'; // Default 1.0 HF
    }
  }

  /**
   * Safely calculate health factor with error handling
   */
  private async calculateHealthFactorSafely(
    collaterals: Array<{ id: string; token: string; amount: string }>,
    debts: Array<{ id: string; token: string; amount: string; interestRateMode: string }>,
  ): Promise<string> {
    try {
      // Transform data to match calculateHealthFactor signature
      const collateralData = collaterals.map(c => ({ token: c.token, amount: c.amount }));
      const debtData = debts.map(d => ({ token: d.token, amount: d.amount }));

      return await calculateHealthFactor(collateralData, debtData);
    } catch (error) {
      console.error('Error calculating health factor:', error);
      return '1000000000000000000'; // Default 1.0 HF on error
    }
  }
}

export default DebtPositionService;
