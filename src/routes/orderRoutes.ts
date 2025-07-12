import express, { Request, Response } from "express";
import { IOrder, Order } from "../models/Order";
import DebtPositionService from "../services/debtPositionService";
import { ApiResponse } from "../types";
import {
  canExecuteOrder,
  generateOrderId,
  validateFullSellOrder,
  validatePartialSellOrder,
  verifyEIP712FullSellOrderSignature,
  verifyEIP712PartialSellOrderSignature,
} from "../utils/orderHelpers";

const router = express.Router();

/**
 * Helper function to get current Health Factor for an order
 */
async function getCurrentHealthFactor(debtAddress: string): Promise<string> {
  const debtPositionService = DebtPositionService.getInstance();
  return await debtPositionService.getCurrentHealthFactor(debtAddress);
}

/**
 * POST /orders - Create a new off-chain order
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      orderType,
      chainId,
      contractAddress,
      seller,
      fullSellOrder,
      partialSellOrder,
    } = req.body;

    // Basic validation
    if (!orderType || !["FULL", "PARTIAL"].includes(orderType)) {
      const response: ApiResponse = {
        success: false,
        error: "Invalid order type. Must be FULL or PARTIAL",
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    if (!chainId || !contractAddress || !seller) {
      const response: ApiResponse = {
        success: false,
        error: "Missing required fields: chainId, contractAddress, seller",
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    let validationResult;

    // Validate order based on type and ensure mutual exclusivity
    if (orderType === "FULL") {
      if (!fullSellOrder) {
        const response: ApiResponse = {
          success: false,
          error: "Full sell order data required for FULL order type",
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      if (partialSellOrder) {
        const response: ApiResponse = {
          success: false,
          error: "Partial sell order data must be null for FULL order type",
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      validationResult = validateFullSellOrder(fullSellOrder);
      if (!validationResult.valid) {
        const response: ApiResponse = {
          success: false,
          error: `Invalid full sell order: ${validationResult.errors.join(
            ", "
          )}`,
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      // Verify signature using EIP-712 method (matching updated contract)
      const isValidSignature = verifyEIP712FullSellOrderSignature(
        chainId,
        contractAddress,
        fullSellOrder,
        seller
      );
      if (!isValidSignature) {
        const response: ApiResponse = {
          success: false,
          error: "Invalid signature",
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }
    } else if (orderType === "PARTIAL") {
      if (!partialSellOrder) {
        const response: ApiResponse = {
          success: false,
          error: "Partial sell order data required for PARTIAL order type",
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      if (fullSellOrder) {
        const response: ApiResponse = {
          success: false,
          error: "Full sell order data must be null for PARTIAL order type",
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      validationResult = validatePartialSellOrder(partialSellOrder);
      if (!validationResult.valid) {
        const response: ApiResponse = {
          success: false,
          error: `Invalid partial sell order: ${validationResult.errors.join(
            ", "
          )}`,
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      // Verify signature using EIP-712 method (matching updated contract)
      const isValidSignature = verifyEIP712PartialSellOrderSignature(
        chainId,
        contractAddress,
        partialSellOrder!,
        seller
      );
      if (!isValidSignature) {
        const response: ApiResponse = {
          success: false,
          error: "Invalid signature",
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }
    }

    // Check for duplicate orders
    const existingOrder = await Order.findOne({
      debtAddress:
        orderType === "FULL" ? fullSellOrder.debt : partialSellOrder!.debt,
      debtNonce:
        orderType === "FULL"
          ? fullSellOrder.debtNonce
          : partialSellOrder!.debtNonce,
      orderType,
      status: "ACTIVE",
    });

    if (existingOrder) {
      const response: ApiResponse = {
        success: false,
        error: `An active ${orderType} order already exists for this debt position. To create a new order, you must either: (1) cancel the existing order on-chain to increment the debt nonce, or (2) wait for the existing order to expire.`,
        data: {
          existingOrderId: existingOrder.id,
          existingOrderExpiry: existingOrder.endTime,
        },
        timestamp: new Date().toISOString(),
      };
      return res.status(409).json(response);
    }

    // Create order document
    const orderData: Partial<IOrder> = {
      id: generateOrderId(
        orderType,
        orderType === "FULL" ? fullSellOrder : partialSellOrder!
      ),
      orderType,
      chainId,
      contractAddress,
      seller,
      status: "ACTIVE",
    };

    if (orderType === "FULL") {
      orderData.fullSellOrder = fullSellOrder;
    } else {
      // Convert repayAmount from wei to decimal format for database storage
      const partialOrderForDB = { ...partialSellOrder! };

      // Check if repayAmount is in wei format (large number), convert to decimal
      const repayAmountBigInt = BigInt(partialSellOrder!.repayAmount);

      // Get token decimals using same mapping as frontend
      let tokenDecimals = 18; // Default to 18 decimals

      // Token decimals mapping (should match frontend SUPPORTED_TOKENS)
      const tokenDecimalsMap: Record<string, number> = {
        // WETH
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": 18, // Mainnet
        "0xd6c774778564ec1973b24a15ee4a5d00742e6575": 18, // Sepolia
        // WBTC
        "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": 8, // Mainnet
        "0x1b8ea7c3b44465be550ebaef50ff6bc5f25ee50c": 8, // Sepolia
        // USDC
        "0xa0b86a33e6e6ed6c7f7b8d4b7f8f6b7e6e6e6e6e": 6, // Mainnet
        "0x005104eb2fd93a0c8f26e18934289ab91596e6bf": 6, // Sepolia
        // DAI
        "0x6b175474e89094c44da98b954eedeac495271d0f": 18, // Mainnet
        "0xe0f11265b326df8f5c3e1db6aa8dcd506fd4cc5b": 18, // Sepolia
        // USDT
        "0xdac17f958d2ee523a2206206994597c13d831ec7": 6, // Mainnet
        "0xd9126e24fc2e1bb395cca8b03c5e2aefabac35ea": 6, // Sepolia
        // LINK
        "0x514910771af9ca656af840dff83e8264ecf986ca": 18, // Mainnet
        "0x2aa4fc36242b9e4e169542305d16dff2cc0ecdae": 18, // Sepolia
      };

      // Check if we have decimals info for this token (case insensitive)
      const tokenAddress = partialSellOrder!.repayToken.toLowerCase();
      for (const [addr, decimals] of Object.entries(tokenDecimalsMap)) {
        if (addr.toLowerCase() === tokenAddress) {
          tokenDecimals = decimals;
          break;
        }
      }

      const repayAmountDecimal = (
        Number(repayAmountBigInt) / Math.pow(10, tokenDecimals)
      ).toString();

      partialOrderForDB.repayAmount = repayAmountDecimal;
      orderData.partialSellOrder = partialOrderForDB;
    }

    const order = new Order(orderData);
    await order.save();

    const response: ApiResponse = {
      success: true,
      data: {
        id: order.id,
        orderType: order.orderType,
        status: order.status,
        debtAddress: order.debtAddress,
        seller: order.seller,
        startTime: order.startTime,
        endTime: order.endTime,
        triggerHF: order.triggerHF,
        createdAt: order.createdAt,
        message: "Order created successfully",
      },
      timestamp: new Date().toISOString(),
    };
    return res.status(201).json(response);
  } catch (error) {
    console.error("Error creating order:", error);
    const response: ApiResponse = {
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /orders - Get orders with filtering and pagination
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      seller,
      debtAddress,
      status = "ACTIVE",
      orderType,
      chainId,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter query
    const filter: any = {};

    if (seller) filter.seller = seller;
    if (debtAddress) filter.debtAddress = debtAddress;
    if (status) filter.status = status;
    if (orderType) filter.orderType = orderType;
    if (chainId) filter.chainId = parseInt(chainId as string);

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === "desc" ? -1 : 1;

    // Execute query
    const [orders, total] = await Promise.all([
      Order.find(filter).sort(sortOptions).skip(skip).limit(limitNum).lean(),
      Order.countDocuments(filter),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limitNum);
    const hasNext = pageNum < totalPages;
    const hasPrev = pageNum > 1;

    // Calculate canExecute status for each order with real-time HF and include debt position data
    const debtPositionService = DebtPositionService.getInstance();
    const ordersWithExecuteStatus = await Promise.all(
      orders.map(async (order) => {
        const currentHF = await getCurrentHealthFactor(order.debtAddress);
        const debtPosition = await debtPositionService.getDebtPositionForOrder(
          order.debtAddress
        );
        const canExecuteStatus = canExecuteOrder(
          order.startTime,
          order.endTime,
          order.status,
          order.triggerHF,
          currentHF
        );

        return {
          id: order.id,
          orderType: order.orderType,
          status: order.status,
          debtAddress: order.debtAddress,
          debtNonce: order.debtNonce,
          seller: order.seller,
          startTime: order.startTime,
          endTime: order.endTime,
          triggerHF: order.triggerHF,
          currentHF: currentHF,
          fullSellOrder: order.fullSellOrder,
          partialSellOrder: order.partialSellOrder,
          canExecute: canExecuteStatus,
          debtPosition: debtPosition, // Include debt position data
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          buyer: order.buyer,
          bonus: order.fullSellOrder?.bonus || order.partialSellOrder?.bonus,
          usdValue: order.usdValue,
          usdBonus: order.usdBonus,
        };
      })
    );

    const response: ApiResponse = {
      success: true,
      data: {
        orders: ordersWithExecuteStatus,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: total,
          itemsPerPage: limitNum,
          hasNext,
          hasPrev,
        },
      },
      timestamp: new Date().toISOString(),
    };
    return res.json(response);
  } catch (error) {
    console.error("Error fetching orders:", error);
    const response: ApiResponse = {
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /orders/active - Get orders that can be executed (within time window and not expired)
 */
router.get("/active", async (req: Request, res: Response) => {
  try {
    const { chainId, seller, debtAddress, orderType } = req.query;
    const now = new Date();

    // Build filter for active, executable orders
    const filter: any = {
      status: "ACTIVE",
      startTime: { $lte: now },
      endTime: { $gte: now },
    };

    if (chainId) filter.chainId = parseInt(chainId as string);
    if (seller) filter.seller = seller;
    if (debtAddress) filter.debtAddress = debtAddress;
    if (orderType) filter.orderType = orderType;

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Calculate real execution status for each order including HF check and debt position data
    const debtPositionService = DebtPositionService.getInstance();
    const ordersWithRealExecuteStatus = await Promise.all(
      orders.map(async (order) => {
        const currentHF = await getCurrentHealthFactor(order.debtAddress);
        const debtPosition = await debtPositionService.getDebtPositionForOrder(
          order.debtAddress
        );
        const canExecuteStatus = canExecuteOrder(
          order.startTime,
          order.endTime,
          order.status,
          order.triggerHF,
          currentHF
        );

        return {
          id: order.id,
          orderType: order.orderType,
          status: order.status,
          debtAddress: order.debtAddress,
          debtNonce: order.debtNonce,
          seller: order.seller,
          startTime: order.startTime,
          endTime: order.endTime,
          triggerHF: order.triggerHF,
          fullSellOrder: order.fullSellOrder,
          partialSellOrder: order.partialSellOrder,
          createdAt: order.createdAt,
          canExecute: canExecuteStatus,
          debtPosition: debtPosition, // Include debt position data
        };
      })
    );

    // Filter to only return truly executable orders (HF check passed)
    const executableOrders = ordersWithRealExecuteStatus.filter(
      (order) => order.canExecute === "YES"
    );

    const response: ApiResponse = {
      success: true,
      data: {
        orders: executableOrders,
        count: executableOrders.length,
      },
      timestamp: new Date().toISOString(),
    };
    return res.json(response);
  } catch (error) {
    console.error("Error fetching active orders:", error);
    const response: ApiResponse = {
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /orders/:id - Get order by ID with full details
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({ id }).lean();

    if (!order) {
      const response: ApiResponse = {
        success: false,
        error: "Order not found",
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    // Get current Health Factor, debt position data, and check executability
    const debtPositionService = DebtPositionService.getInstance();
    const currentHF = await getCurrentHealthFactor(order.debtAddress);
    const debtPosition = await debtPositionService.getDebtPositionForOrder(
      order.debtAddress
    );
    const canExecuteStatus = canExecuteOrder(
      order.startTime,
      order.endTime,
      order.status,
      order.triggerHF,
      currentHF
    );

    const response: ApiResponse = {
      success: true,
      data: {
        ...order,
        canExecute: canExecuteStatus,
        debtPosition: debtPosition, // Include debt position data
      },
      timestamp: new Date().toISOString(),
    };
    return res.json(response);
  } catch (error) {
    console.error("Error fetching order:", error);
    const response: ApiResponse = {
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

export default router;
