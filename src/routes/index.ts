import express, { Request, Response } from "express";
import SubgraphCacheService from "../services/cache";
import DatabaseService from "../services/database";
import SubgraphService from "../services/subgraph";
import { ApiResponse, GraphQLQuery } from "../types";
import { calculateHealthFactor } from "../utils/orderHelpers";
import orderRoutes from "./orderRoutes";

const router = express.Router();

// Health check endpoint
router.get("/health", async (req: Request, res: Response) => {
  try {
    const dbService = DatabaseService.getInstance();
    const cacheService = SubgraphCacheService.getInstance();

    const dbConnected = dbService.getConnectionStatus();
    const dbPing = await dbService.ping();
    const stats = await cacheService.getStats();

    const response: ApiResponse = {
      success: true,
      data: {
        status: "healthy",
        database: {
          connected: dbConnected,
          ping: dbPing,
        },
        cache: stats,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: "Health check failed",
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

// Generic subgraph query endpoint
router.post("/subgraph", async (req: Request, res: Response) => {
  try {
    const { query, variables, operationName }: GraphQLQuery = req.body;

    if (!query) {
      const response: ApiResponse = {
        success: false,
        error: "GraphQL query is required",
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    const subgraphService = SubgraphService.getInstance();
    const result = await subgraphService.executeQuery({
      query,
      variables,
      operationName,
    });

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

// Get cached users
router.get("/users", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const cacheService = SubgraphCacheService.getInstance();
    const users = await cacheService.getCachedUsers(limit, offset);

    const response: ApiResponse = {
      success: true,
      data: {
        users,
        pagination: {
          limit,
          offset,
          count: users.length,
        },
      },
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

// Get cached debt positions with real-time health factors
router.get("/positions", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const owner = req.query.owner as string;

    const cacheService = SubgraphCacheService.getInstance();
    const positions = await cacheService.getCachedDebtPositions(
      limit,
      offset,
      owner
    );

    // Calculate real-time health factor for each position
    const positionsWithHealthFactor = await Promise.all(
      positions.map(async (position) => {
        try {
          const healthFactor = await calculateHealthFactor(
            position.collaterals,
            position.debts
          );

          return {
            ...position,
            healthFactor,
          };
        } catch (error) {
          console.error(
            `Error calculating HF for position ${position.id}:`,
            error
          );
          return {
            ...position,
            healthFactor: "1000000000000000000", // Default 1.0 HF on error
          };
        }
      })
    );

    const response: ApiResponse = {
      success: true,
      data: {
        positions: positionsWithHealthFactor,
        pagination: {
          limit,
          offset,
          count: positionsWithHealthFactor.length,
          owner,
        },
      },
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

// Get cached orders from subgraph
router.get("/cached-orders", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const executed =
      req.query.executed === "true"
        ? true
        : req.query.executed === "false"
        ? false
        : undefined;
    const cancelled =
      req.query.cancelled === "true"
        ? true
        : req.query.cancelled === "false"
        ? false
        : undefined;
    const orderType = req.query.orderType as string;

    const filters: any = {};
    if (executed !== undefined) filters.executed = executed;
    if (cancelled !== undefined) filters.cancelled = cancelled;
    if (orderType) filters.orderType = orderType;

    const cacheService = SubgraphCacheService.getInstance();
    const orders = await cacheService.getCachedOrders(limit, offset, filters);

    const response: ApiResponse = {
      success: true,
      data: {
        orders,
        pagination: {
          limit,
          offset,
          count: orders.length,
        },
        filters,
      },
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

// Get cached price tokens
router.get("/prices", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const symbol = req.query.symbol as string;

    const cacheService = SubgraphCacheService.getInstance();
    const tokens = await cacheService.getCachedPriceTokens(
      limit,
      offset,
      symbol
    );

    const response: ApiResponse = {
      success: true,
      data: {
        tokens,
        pagination: {
          limit,
          offset,
          count: tokens.length,
          symbol,
        },
      },
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

// Get cache statistics
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const cacheService = SubgraphCacheService.getInstance();
    const stats = await cacheService.getStats();

    const response: ApiResponse = {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

// Get cached liquidation thresholds
router.get("/liquidation-thresholds", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const symbol = req.query.symbol as string;
    const isActive =
      req.query.isActive === "true"
        ? true
        : req.query.isActive === "false"
        ? false
        : undefined;

    const cacheService = SubgraphCacheService.getInstance();
    const assetConfigurations =
      await cacheService.getCachedLiquidationThresholds(
        limit,
        offset,
        symbol,
        isActive
      );

    const response: ApiResponse = {
      success: true,
      data: {
        assetConfigurations,
        pagination: {
          limit,
          offset,
          count: assetConfigurations.length,
          symbol,
          isActive,
        },
      },
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

// Orders (signed orders stored in database)
router.use("/orders", orderRoutes);

export default router;
