import request from "supertest";
import express from "express";
import { describe, it, expect, beforeEach } from "@jest/globals";
import orderRoutes from "../src/routes/orderRoutes";
import { Order } from "../src/models/Order";
import {
  TEST_CHAIN_ID,
  TEST_CONTRACT_ADDRESS,
  TEST_ADDRESS,
  TEST_WALLET,
  createValidFullSellOrder,
  createValidPartialSellOrder,
  signFullSellOrder,
  signPartialSellOrder,
} from "./testUtils";

// Create Express app for testing
const app = express();
app.use(express.json());
app.use("/api/orders", orderRoutes);

describe("POST /api/orders - Create Order Full Flow", () => {
  beforeEach(async () => {
    // Clean up database before each test
    await Order.deleteMany({});
  });

  describe("Full Sell Order", () => {
    it("should create a valid full sell order with proper signature", async () => {
      // Arrange
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
        seller: TEST_ADDRESS,
        fullSellOrder: {
          ...orderData,
          ...signature,
        },
      };

      // Act
      const response = await request(app)
        .post("/api/orders")
        .send(requestBody)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        orderType: "FULL",
        status: "ACTIVE",
        debtAddress: orderData.debt,
        seller: TEST_ADDRESS,
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.createdAt).toBeDefined();

      // Verify order was saved to database
      const savedOrder = await Order.findOne({ id: response.body.data.id });
      expect(savedOrder).toBeTruthy();
      expect(savedOrder?.orderType).toBe("FULL");
      expect(savedOrder?.fullSellOrder).toMatchObject(
        requestBody.fullSellOrder
      );
    });

    it("should reject duplicate full sell order for same debt position", async () => {
      // Arrange - Create first order
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
        seller: TEST_ADDRESS,
        fullSellOrder: {
          ...orderData,
          ...signature,
        },
      };

      // Create first order
      await request(app).post("/api/orders").send(requestBody).expect(201);

      // Act - Try to create duplicate order
      const response = await request(app)
        .post("/api/orders")
        .send(requestBody)
        .expect(409);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain(
        "An active FULL order already exists"
      );
      expect(response.body.data.existingOrderId).toBeDefined();
      expect(response.body.data.existingOrderExpiry).toBeDefined();
    });

    it("should reject order with invalid signature", async () => {
      // Arrange
      const orderData = createValidFullSellOrder();

      const requestBody = {
        orderType: "FULL",
        chainId: TEST_CHAIN_ID,
        contractAddress: TEST_CONTRACT_ADDRESS,
        seller: TEST_ADDRESS,
        fullSellOrder: {
          ...orderData,
          // Invalid signature
          v: 27,
          r: "0x1234567890123456789012345678901234567890123456789012345678901234",
          s: "0x1234567890123456789012345678901234567890123456789012345678901234",
        },
      };

      // Act
      const response = await request(app)
        .post("/api/orders")
        .send(requestBody)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid signature");
    });

    it("should reject order with missing required fields", async () => {
      // Arrange
      const requestBody = {
        orderType: "FULL",
        chainId: TEST_CHAIN_ID,
        // Missing contractAddress and seller
        fullSellOrder: createValidFullSellOrder(),
      };

      // Act
      const response = await request(app)
        .post("/api/orders")
        .send(requestBody)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Missing required fields");
    });

    it("should reject order with both full and partial data", async () => {
      // Arrange
      const requestBody = {
        orderType: "FULL",
        chainId: TEST_CHAIN_ID,
        contractAddress: TEST_CONTRACT_ADDRESS,
        seller: TEST_ADDRESS,
        fullSellOrder: createValidFullSellOrder(),
        partialSellOrder: createValidPartialSellOrder(), // Should not be present
      };

      // Act
      const response = await request(app)
        .post("/api/orders")
        .send(requestBody)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain(
        "Partial sell order data must be null for FULL order type"
      );
    });
  });

  describe("Partial Sell Order", () => {
    it("should create a valid partial sell order with proper signature", async () => {
      // Arrange
      const orderData = createValidPartialSellOrder();
      const signature = await signPartialSellOrder(
        TEST_CHAIN_ID,
        TEST_CONTRACT_ADDRESS,
        orderData,
        TEST_WALLET
      );

      const requestBody = {
        orderType: "PARTIAL",
        chainId: TEST_CHAIN_ID,
        contractAddress: TEST_CONTRACT_ADDRESS,
        seller: TEST_ADDRESS,
        partialSellOrder: {
          ...orderData,
          ...signature,
        },
      };

      // Act
      const response = await request(app)
        .post("/api/orders")
        .send(requestBody)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        orderType: "PARTIAL",
        status: "ACTIVE",
        debtAddress: orderData.debt,
        seller: TEST_ADDRESS,
      });
      expect(response.body.data.id).toBeDefined();

      // Verify order was saved to database
      const savedOrder = await Order.findOne({ id: response.body.data.id });
      expect(savedOrder).toBeTruthy();
      expect(savedOrder?.orderType).toBe("PARTIAL");
      expect(savedOrder?.partialSellOrder).toMatchObject(
        requestBody.partialSellOrder
      );
    });

    it("should reject duplicate partial sell order for same debt position", async () => {
      // Arrange - Create first order
      const orderData = createValidPartialSellOrder();
      const signature = await signPartialSellOrder(
        TEST_CHAIN_ID,
        TEST_CONTRACT_ADDRESS,
        orderData,
        TEST_WALLET
      );

      const requestBody = {
        orderType: "PARTIAL",
        chainId: TEST_CHAIN_ID,
        contractAddress: TEST_CONTRACT_ADDRESS,
        seller: TEST_ADDRESS,
        partialSellOrder: {
          ...orderData,
          ...signature,
        },
      };

      // Create first order
      await request(app).post("/api/orders").send(requestBody).expect(201);

      // Act - Try to create duplicate order
      const response = await request(app)
        .post("/api/orders")
        .send(requestBody)
        .expect(409);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain(
        "An active PARTIAL order already exists"
      );
      expect(response.body.data.existingOrderId).toBeDefined();
    });
  });

  describe("Mixed Order Types", () => {
    it("should allow both FULL and PARTIAL orders for same debt position", async () => {
      const debtAddress = "0x1234567890123456789012345678901234567890";

      // Arrange - Create full sell order
      const fullOrderData = {
        ...createValidFullSellOrder(),
        debt: debtAddress,
      };
      const fullSignature = await signFullSellOrder(
        TEST_CHAIN_ID,
        TEST_CONTRACT_ADDRESS,
        fullOrderData,
        TEST_WALLET
      );

      const fullOrderRequest = {
        orderType: "FULL",
        chainId: TEST_CHAIN_ID,
        contractAddress: TEST_CONTRACT_ADDRESS,
        seller: TEST_ADDRESS,
        fullSellOrder: {
          ...fullOrderData,
          ...fullSignature,
        },
      };

      // Arrange - Create partial sell order
      const partialOrderData = {
        ...createValidPartialSellOrder(),
        debt: debtAddress,
      };
      const partialSignature = await signPartialSellOrder(
        TEST_CHAIN_ID,
        TEST_CONTRACT_ADDRESS,
        partialOrderData,
        TEST_WALLET
      );

      const partialOrderRequest = {
        orderType: "PARTIAL",
        chainId: TEST_CHAIN_ID,
        contractAddress: TEST_CONTRACT_ADDRESS,
        seller: TEST_ADDRESS,
        partialSellOrder: {
          ...partialOrderData,
          ...partialSignature,
        },
      };

      // Act - Create both orders
      const fullResponse = await request(app)
        .post("/api/orders")
        .send(fullOrderRequest)
        .expect(201);

      const partialResponse = await request(app)
        .post("/api/orders")
        .send(partialOrderRequest)
        .expect(201);

      // Assert
      expect(fullResponse.body.success).toBe(true);
      expect(partialResponse.body.success).toBe(true);
      expect(fullResponse.body.data.debtAddress).toBe(debtAddress);
      expect(partialResponse.body.data.debtAddress).toBe(debtAddress);

      // Verify both orders exist in database
      const orders = await Order.find({ debtAddress, status: "ACTIVE" });
      expect(orders).toHaveLength(2);
      expect(orders.map((o) => o.orderType).sort()).toEqual([
        "FULL",
        "PARTIAL",
      ]);
    });
  });

  describe("Edge Cases", () => {
    it("should reject order with invalid order type", async () => {
      // Arrange
      const requestBody = {
        orderType: "INVALID",
        chainId: TEST_CHAIN_ID,
        contractAddress: TEST_CONTRACT_ADDRESS,
        seller: TEST_ADDRESS,
        fullSellOrder: createValidFullSellOrder(),
      };

      // Act
      const response = await request(app)
        .post("/api/orders")
        .send(requestBody)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid order type");
    });

    it("should reject order with expired time", async () => {
      // Arrange - Create order with past end time
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const orderData = {
        ...createValidFullSellOrder(),
        startTime: pastTime - 3600,
        endTime: pastTime,
      };

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
        seller: TEST_ADDRESS,
        fullSellOrder: {
          ...orderData,
          ...signature,
        },
      };

      // Act
      const response = await request(app)
        .post("/api/orders")
        .send(requestBody)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Invalid full sell order");
    });
  });
});
