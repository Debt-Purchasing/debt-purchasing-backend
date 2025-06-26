import request from "supertest";
import app from "../src/index";
import { Order } from "../src/models/Order";
import {
  createValidFullSellOrder,
  createValidPartialSellOrder,
  signFullSellOrder,
  signPartialSellOrder,
  TEST_WALLET,
  TEST_CONTRACT_ADDRESS,
  TEST_CHAIN_ID,
} from "./testUtils";
import { describe, it, expect, beforeEach } from "@jest/globals";

// Import shared MongoDB setup
import "./setup";

describe("Order Lifecycle - Execute & Cancel Simulation", () => {
  beforeEach(async () => {
    // Clean up orders before each test
    await Order.deleteMany({});
  });

  describe("Order Execution Simulation (via Subgraph)", () => {
    it("should update order status to EXECUTED when execution event is processed", async () => {
      // Arrange - Create an active order
      const orderData = createValidFullSellOrder();
      const signature = await signFullSellOrder(
        TEST_CHAIN_ID,
        TEST_CONTRACT_ADDRESS,
        orderData,
        TEST_WALLET
      );

      const requestBody = {
        orderType: "FULL",
        chainId: TEST_CHAIN_ID,
        contractAddress: TEST_CONTRACT_ADDRESS,
        seller: TEST_WALLET.address,
        fullSellOrder: { ...orderData, ...signature },
      };

      // Create order
      const createResponse = await request(app)
        .post("/api/orders")
        .send(requestBody)
        .expect(201);

      const orderId = createResponse.body.data.id;

      // Act - Simulate execution via direct database update (like subgraph sync would do)
      const buyer = "0x742d35Cc6634C0532925a3b8D44c6b96b69b1234";
      const txHash = "0x1234567890abcdef";
      const executionDate = new Date();

      await Order.findOneAndUpdate(
        { id: orderId },
        {
          status: "EXECUTED",
          executedBy: buyer,
          executedAt: executionDate,
          executionTxHash: txHash,
        }
      );

      // Assert - Verify order is marked as executed
      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("EXECUTED");
      expect(response.body.data.executedBy).toBe(buyer);
      expect(response.body.data.executionTxHash).toBe(txHash);
      expect(new Date(response.body.data.executedAt)).toEqual(executionDate);
    });

    it("should not return executed orders in active orders endpoint", async () => {
      // Arrange - Create and execute an order
      const orderData = createValidFullSellOrder();
      const signature = await signFullSellOrder(
        TEST_CHAIN_ID,
        TEST_CONTRACT_ADDRESS,
        orderData,
        TEST_WALLET
      );

      const requestBody = {
        orderType: "FULL",
        chainId: TEST_CHAIN_ID,
        contractAddress: TEST_CONTRACT_ADDRESS,
        seller: TEST_WALLET.address,
        fullSellOrder: { ...orderData, ...signature },
      };

      // Create order
      const createResponse = await request(app)
        .post("/api/orders")
        .send(requestBody)
        .expect(201);

      const orderId = createResponse.body.data.id;

      // Execute order
      await Order.findOneAndUpdate(
        { id: orderId },
        {
          status: "EXECUTED",
          executedBy: "0x742d35Cc6634C0532925a3b8D44c6b96b69b1234",
          executedAt: new Date(),
          executionTxHash: "0x1234567890abcdef",
        }
      );

      // Act - Get active orders
      const response = await request(app).get("/api/orders/active").expect(200);

      // Assert - Executed order should not appear in active orders
      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(0);
      expect(response.body.data.count).toBe(0);
    });

    it("should handle execution of both FULL and PARTIAL orders", async () => {
      // Arrange - Create both types of orders
      const fullOrderData = createValidFullSellOrder();
      const partialOrderData = createValidPartialSellOrder();

      const fullSignature = await signFullSellOrder(
        TEST_CHAIN_ID,
        TEST_CONTRACT_ADDRESS,
        fullOrderData,
        TEST_WALLET
      );

      const partialSignature = await signPartialSellOrder(
        TEST_CHAIN_ID,
        TEST_CONTRACT_ADDRESS,
        partialOrderData,
        TEST_WALLET
      );

      // Create full order
      const fullOrderRequest = {
        orderType: "FULL",
        chainId: TEST_CHAIN_ID,
        contractAddress: TEST_CONTRACT_ADDRESS,
        seller: TEST_WALLET.address,
        fullSellOrder: { ...fullOrderData, ...fullSignature },
      };

      // Create partial order
      const partialOrderRequest = {
        orderType: "PARTIAL",
        chainId: TEST_CHAIN_ID,
        contractAddress: TEST_CONTRACT_ADDRESS,
        seller: TEST_WALLET.address,
        partialSellOrder: { ...partialOrderData, ...partialSignature },
      };

      const fullResponse = await request(app)
        .post("/api/orders")
        .send(fullOrderRequest)
        .expect(201);

      const partialResponse = await request(app)
        .post("/api/orders")
        .send(partialOrderRequest)
        .expect(201);

      // Act - Execute both orders
      const buyer = "0x742d35Cc6634C0532925a3b8D44c6b96b69b1234";

      await Order.findOneAndUpdate(
        { id: fullResponse.body.data.id },
        {
          status: "EXECUTED",
          executedBy: buyer,
          executedAt: new Date(),
          executionTxHash: "0xfull1234567890abcdef",
        }
      );

      await Order.findOneAndUpdate(
        { id: partialResponse.body.data.id },
        {
          status: "EXECUTED",
          executedBy: buyer,
          executedAt: new Date(),
          executionTxHash: "0xpartial1234567890abcdef",
        }
      );

      // Assert - Both orders should be executed
      const fullOrderCheck = await request(app)
        .get(`/api/orders/${fullResponse.body.data.id}`)
        .expect(200);

      const partialOrderCheck = await request(app)
        .get(`/api/orders/${partialResponse.body.data.id}`)
        .expect(200);

      expect(fullOrderCheck.body.data.status).toBe("EXECUTED");
      expect(partialOrderCheck.body.data.status).toBe("EXECUTED");
    });
  });

  describe("Order Cancellation Simulation (via Debt Nonce Change)", () => {
    it("should auto-cancel orders when debt nonce changes", async () => {
      // Arrange - Create order with nonce 0
      const orderData = createValidFullSellOrder();
      orderData.debtNonce = 0; // Current nonce

      const signature = await signFullSellOrder(
        TEST_CHAIN_ID,
        TEST_CONTRACT_ADDRESS,
        orderData,
        TEST_WALLET
      );

      const requestBody = {
        orderType: "FULL",
        chainId: TEST_CHAIN_ID,
        contractAddress: TEST_CONTRACT_ADDRESS,
        seller: TEST_WALLET.address,
        fullSellOrder: { ...orderData, ...signature },
      };

      const createResponse = await request(app)
        .post("/api/orders")
        .send(requestBody)
        .expect(201);

      const orderId = createResponse.body.data.id;

      // Act - Simulate debt nonce change (like when user cancels on-chain)
      // This simulates what cache service would do when processing DebtPosition updates
      await Order.updateMany(
        {
          debtAddress: orderData.debt,
          debtNonce: { $lt: 1 }, // New nonce is 1, old orders have nonce < 1
          status: "ACTIVE",
        },
        {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: "Debt nonce incremented",
        }
      );

      // Assert - Order should be cancelled
      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("CANCELLED");
      expect(response.body.data.cancelReason).toBe("Debt nonce incremented");
    });

    it("should not cancel orders with current nonce when debt nonce changes", async () => {
      // Arrange - Create orders with different nonces for different debt positions
      // Note: We can't have 2 orders of same type for same debt position due to duplicate validation
      const oldDebtAddress = "0x1234567890123456789012345678901234567890";
      const currentDebtAddress = "0x1234567890123456789012345678901234567891";

      const oldOrderData = createValidFullSellOrder();
      oldOrderData.debtNonce = 0;
      oldOrderData.debt = oldDebtAddress;

      const currentOrderData = createValidFullSellOrder(); // Changed to FULL to avoid same type conflict
      currentOrderData.debtNonce = 1; // Current nonce
      currentOrderData.debt = currentDebtAddress;

      const oldSignature = await signFullSellOrder(
        TEST_CHAIN_ID,
        TEST_CONTRACT_ADDRESS,
        oldOrderData,
        TEST_WALLET
      );

      const currentSignature = await signFullSellOrder(
        TEST_CHAIN_ID,
        TEST_CONTRACT_ADDRESS,
        currentOrderData,
        TEST_WALLET
      );

      // Create old order (nonce 0)
      const oldResponse = await request(app)
        .post("/api/orders")
        .send({
          orderType: "FULL",
          chainId: TEST_CHAIN_ID,
          contractAddress: TEST_CONTRACT_ADDRESS,
          seller: TEST_WALLET.address,
          fullSellOrder: { ...oldOrderData, ...oldSignature },
        });

      expect(oldResponse.status).toBe(201);

      // Create current order (nonce 1)
      const currentResponse = await request(app)
        .post("/api/orders")
        .send({
          orderType: "FULL",
          chainId: TEST_CHAIN_ID,
          contractAddress: TEST_CONTRACT_ADDRESS,
          seller: TEST_WALLET.address,
          fullSellOrder: { ...currentOrderData, ...currentSignature },
        });

      expect(currentResponse.status).toBe(201);

      // Act - Simulate nonce change to 1 for old debt position (cancel orders with nonce < 1)
      await Order.updateMany(
        {
          debtAddress: oldDebtAddress,
          debtNonce: { $lt: 1 },
          status: "ACTIVE",
        },
        {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: "Debt nonce incremented",
        }
      );

      // Assert - Check both cancelled and active orders
      const cancelledOrders = await request(app)
        .get("/api/orders")
        .query({ status: "CANCELLED" })
        .expect(200);

      const activeOrders = await request(app)
        .get("/api/orders")
        .query({ status: "ACTIVE" })
        .expect(200);

      const cancelledOrdersList = cancelledOrders.body.data.orders;
      const activeOrdersList = activeOrders.body.data.orders;
      const allOrdersList = [...cancelledOrdersList, ...activeOrdersList];

      const oldOrder = allOrdersList.find(
        (o: any) => o.debtAddress === oldDebtAddress
      );
      const currentOrder = allOrdersList.find(
        (o: any) => o.debtAddress === currentDebtAddress
      );

      expect(oldOrder).toBeDefined();
      expect(currentOrder).toBeDefined();
      expect(oldOrder.status).toBe("CANCELLED");
      expect(currentOrder.status).toBe("ACTIVE");
    });

    it("should exclude expired orders from active orders endpoint", async () => {
      // Arrange - Create order that will expire in 2 seconds
      const orderData = createValidFullSellOrder();
      const nowTime = Math.floor(Date.now() / 1000);
      orderData.startTime = nowTime - 1; // Started 1 second ago
      orderData.endTime = nowTime + 2; // Will expire in 2 seconds

      const signature = await signFullSellOrder(
        TEST_CHAIN_ID,
        TEST_CONTRACT_ADDRESS,
        orderData,
        TEST_WALLET
      );

      const requestBody = {
        orderType: "FULL",
        chainId: TEST_CHAIN_ID,
        contractAddress: TEST_CONTRACT_ADDRESS,
        seller: TEST_WALLET.address,
        fullSellOrder: { ...orderData, ...signature },
      };

      // Create order (should succeed since it's not expired yet)
      const createResponse = await request(app)
        .post("/api/orders")
        .send(requestBody)
        .expect(201);

      // Verify order appears in active orders initially
      const activeBeforeExpiry = await request(app)
        .get("/api/orders/active")
        .expect(200);

      expect(activeBeforeExpiry.body.data.orders).toHaveLength(1);

      // Wait for order to expire
      await new Promise((resolve) => setTimeout(resolve, 2500)); // Wait 2.5 seconds

      // Act - Get active orders (should exclude expired)
      const activeResponse = await request(app)
        .get("/api/orders/active")
        .expect(200);

      // Assert - Expired order should not appear in active orders
      expect(activeResponse.body.data.orders).toHaveLength(0);

      // But should still exist when querying all orders
      const allResponse = await request(app).get("/api/orders").expect(200);

      expect(allResponse.body.data.orders).toHaveLength(1);
      expect(allResponse.body.data.orders[0].status).toBe("ACTIVE"); // Still ACTIVE in DB, just not executable
    });
  });

  describe("Order Lifecycle Integration", () => {
    it("should track complete order lifecycle: ACTIVE → EXECUTED", async () => {
      // Arrange - Create order
      const orderData = createValidFullSellOrder();
      const signature = await signFullSellOrder(
        TEST_CHAIN_ID,
        TEST_CONTRACT_ADDRESS,
        orderData,
        TEST_WALLET
      );

      const requestBody = {
        orderType: "FULL",
        chainId: TEST_CHAIN_ID,
        contractAddress: TEST_CONTRACT_ADDRESS,
        seller: TEST_WALLET.address,
        fullSellOrder: { ...orderData, ...signature },
      };

      // Act & Assert - Track lifecycle

      // 1. Create order
      const createResponse = await request(app)
        .post("/api/orders")
        .send(requestBody)
        .expect(201);

      expect(createResponse.body.data.status).toBe("ACTIVE");

      const orderId = createResponse.body.data.id;

      // 2. Order appears in active orders
      const activeResponse = await request(app)
        .get("/api/orders/active")
        .expect(200);

      expect(activeResponse.body.data.orders).toHaveLength(1);
      expect(activeResponse.body.data.orders[0].id).toBe(orderId);

      // 3. Execute order
      await Order.findOneAndUpdate(
        { id: orderId },
        {
          status: "EXECUTED",
          executedBy: "0x742d35Cc6634C0532925a3b8D44c6b96b69b1234",
          executedAt: new Date(),
          executionTxHash: "0x1234567890abcdef",
        }
      );

      // 4. Order no longer appears in active orders
      const activeAfterExecution = await request(app)
        .get("/api/orders/active")
        .expect(200);

      expect(activeAfterExecution.body.data.orders).toHaveLength(0);

      // 5. Order still accessible by ID with execution details
      const finalResponse = await request(app)
        .get(`/api/orders/${orderId}`)
        .expect(200);

      expect(finalResponse.body.data.status).toBe("EXECUTED");
      expect(finalResponse.body.data.executedBy).toBeDefined();
      expect(finalResponse.body.data.executionTxHash).toBeDefined();
    });
  });
});
