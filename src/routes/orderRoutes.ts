import express, { Request, Response } from 'express';
import { DebtPosition } from '../models/DebtPosition';
import { IOrder, Order } from '../models/Order';
import { ApiResponse } from '../types';
import {
  calculateHealthFactor,
  canExecuteOrder,
  generateOrderId,
  validateFullSellOrder,
  validatePartialSellOrder,
  verifyFullSellOrderSignature,
  verifyPartialSellOrderSignature,
} from '../utils/orderHelpers';

const router = express.Router();

/**
 * Helper function to get current Health Factor for an order
 */
async function getCurrentHealthFactor(debtAddress: string): Promise<string> {
  try {
    const debtPosition = await DebtPosition.findOne({ id: debtAddress }).lean();

    if (!debtPosition) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`Debt position not found: ${debtAddress}`);
      }
      return '1000000000000000000'; // Default 1.0 HF
    }

    // Calculate real-time HF using current prices and asset configurations
    const currentHF = await calculateHealthFactor(debtPosition.collaterals, debtPosition.debts);

    return currentHF;
  } catch (error) {
    console.error(`Error getting current HF for ${debtAddress}:`, error);
    return '1000000000000000000'; // Default 1.0 HF
  }
}

/**
 * POST /orders - Create a new off-chain order
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { orderType, chainId, contractAddress, seller, fullSellOrder, partialSellOrder } = req.body;

    // Basic validation
    if (!orderType || !['FULL', 'PARTIAL'].includes(orderType)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid order type. Must be FULL or PARTIAL',
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    if (!chainId || !contractAddress || !seller) {
      const response: ApiResponse = {
        success: false,
        error: 'Missing required fields: chainId, contractAddress, seller',
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    let validationResult;

    // Validate order based on type and ensure mutual exclusivity
    if (orderType === 'FULL') {
      if (!fullSellOrder) {
        const response: ApiResponse = {
          success: false,
          error: 'Full sell order data required for FULL order type',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      if (partialSellOrder) {
        const response: ApiResponse = {
          success: false,
          error: 'Partial sell order data must be null for FULL order type',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      validationResult = validateFullSellOrder(fullSellOrder);
      if (!validationResult.valid) {
        const response: ApiResponse = {
          success: false,
          error: `Invalid full sell order: ${validationResult.errors.join(', ')}`,
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      // Verify signature
      const isValidSignature = verifyFullSellOrderSignature(chainId, contractAddress, fullSellOrder, seller);
      if (!isValidSignature) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid signature',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }
    } else if (orderType === 'PARTIAL') {
      if (!partialSellOrder) {
        const response: ApiResponse = {
          success: false,
          error: 'Partial sell order data required for PARTIAL order type',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      if (fullSellOrder) {
        const response: ApiResponse = {
          success: false,
          error: 'Full sell order data must be null for PARTIAL order type',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      validationResult = validatePartialSellOrder(partialSellOrder);
      if (!validationResult.valid) {
        const response: ApiResponse = {
          success: false,
          error: `Invalid partial sell order: ${validationResult.errors.join(', ')}`,
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      // Verify signature
      const isValidSignature = verifyPartialSellOrderSignature(chainId, contractAddress, partialSellOrder!, seller);
      if (!isValidSignature) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid signature',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }
    }

    // Check for duplicate orders
    const existingOrder = await Order.findOne({
      debtAddress: orderType === 'FULL' ? fullSellOrder.debt : partialSellOrder!.debt,
      debtNonce: orderType === 'FULL' ? fullSellOrder.debtNonce : partialSellOrder!.debtNonce,
      orderType,
      status: 'ACTIVE',
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
      id: generateOrderId(),
      orderType,
      chainId,
      contractAddress,
      seller,
      status: 'ACTIVE',
    };

    if (orderType === 'FULL') {
      orderData.fullSellOrder = fullSellOrder;
    } else {
      orderData.partialSellOrder = partialSellOrder;
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
        message: 'Order created successfully',
      },
      timestamp: new Date().toISOString(),
    };
    return res.status(201).json(response);
  } catch (error) {
    console.error('Error creating order:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /orders - Get orders with filtering and pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      seller,
      debtAddress,
      status = 'ACTIVE',
      orderType,
      chainId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
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
    sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [orders, total] = await Promise.all([
      Order.find(filter).sort(sortOptions).skip(skip).limit(limitNum).lean(),
      Order.countDocuments(filter),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limitNum);
    const hasNext = pageNum < totalPages;
    const hasPrev = pageNum > 1;

    // Calculate canExecute status for each order with real-time HF
    const ordersWithExecuteStatus = await Promise.all(
      orders.map(async order => {
        const currentHF = await getCurrentHealthFactor(order.debtAddress);
        const fullDebtPosition = await DebtPosition.findOne({ id: order.debtAddress }).lean();
        const canExecuteStatus = canExecuteOrder(
          order.startTime,
          order.endTime,
          order.status,
          order.triggerHF,
          currentHF,
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
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        };
      }),
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
    console.error('Error fetching orders:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /orders/active - Get orders that can be executed (within time window and not expired)
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const { chainId, seller, debtAddress, orderType } = req.query;
    const now = new Date();

    // Build filter for active, executable orders
    const filter: any = {
      status: 'ACTIVE',
      startTime: { $lte: now },
      endTime: { $gte: now },
    };

    if (chainId) filter.chainId = parseInt(chainId as string);
    if (seller) filter.seller = seller;
    if (debtAddress) filter.debtAddress = debtAddress;
    if (orderType) filter.orderType = orderType;

    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(50).lean();

    // Calculate real execution status for each order including HF check
    const ordersWithRealExecuteStatus = await Promise.all(
      orders.map(async order => {
        const currentHF = await getCurrentHealthFactor(order.debtAddress);
        const canExecuteStatus = canExecuteOrder(
          order.startTime,
          order.endTime,
          order.status,
          order.triggerHF,
          currentHF,
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
        };
      }),
    );

    // Filter to only return truly executable orders (HF check passed)
    const executableOrders = ordersWithRealExecuteStatus.filter(order => order.canExecute === 'YES');

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
    console.error('Error fetching active orders:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /orders/:id - Get order by ID with full details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({ id }).lean();

    if (!order) {
      const response: ApiResponse = {
        success: false,
        error: 'Order not found',
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    // Get current Health Factor and check executability
    const currentHF = await getCurrentHealthFactor(order.debtAddress);
    const canExecuteStatus = canExecuteOrder(order.startTime, order.endTime, order.status, order.triggerHF, currentHF);

    const response: ApiResponse = {
      success: true,
      data: {
        ...order,
        canExecute: canExecuteStatus,
      },
      timestamp: new Date().toISOString(),
    };
    return res.json(response);
  } catch (error) {
    console.error('Error fetching order:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

export default router;
