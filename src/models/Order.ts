import mongoose, { Document, Schema } from "mongoose";

// Full Sell Order structure from contract
export interface IFullSellOrder {
  // Order title fields (flattened for backend efficiency)
  debt: string;
  debtNonce: number;
  startTime: number;
  endTime: number;
  triggerHF: string;
  // Full sell specific fields
  token: string;
  percentOfEquity: string;
  v: number;
  r: string;
  s: string;
}

// Partial Sell Order structure from contract
export interface IPartialSellOrder {
  // Order title fields (flattened for backend efficiency)
  debt: string;
  debtNonce: number;
  startTime: number;
  endTime: number;
  triggerHF: string;
  // Partial sell specific fields
  interestRateMode: number; // 1 for stable, 2 for variable
  collateralOut: string;
  repayToken: string;
  repayAmount: string;
  bonus: string; // Bonus percentage as string
  v: number;
  r: string;
  s: string;
}

// Main Order document interface
export interface IOrder extends Document {
  id: string; // Unique order ID
  orderType: "FULL" | "PARTIAL";
  chainId: number;
  contractAddress: string; // AaveRouter contract address
  seller: string; // Address of the order creator

  // Order data based on type (only one will be populated)
  fullSellOrder?: IFullSellOrder;
  partialSellOrder?: IPartialSellOrder;

  // Order status
  status: "ACTIVE" | "EXECUTED" | "CANCELLED" | "EXPIRED";

  // Execution details (populated when order gets executed on-chain)
  buyer?: string; // Buyer address when executed
  blockNumber?: string; // Block number of execution
  txHash?: string; // Transaction hash of execution

  // Cancellation details
  cancelledAt?: Date; // When the order was cancelled
  cancelReason?: string; // Reason for cancellation

  // Metadata
  createdAt: Date;
  updatedAt: Date;

  // Computed fields for easy querying (auto-populated from order data)
  debtAddress: string;
  debtNonce: number;
  startTime: Date;
  endTime: Date;
  triggerHF: string;
}

// Full Sell Order Schema
const FullSellOrderSchema = new Schema(
  {
    // Flattened order title fields
    debt: {
      type: String,
      required: true,
      match: /^0x[a-fA-F0-9]{40}$/, // Ethereum address validation
    },
    debtNonce: {
      type: Number,
      required: true,
      min: 0,
    },
    startTime: {
      type: Number,
      required: true,
      min: 0,
    },
    endTime: {
      type: Number,
      required: true,
      min: 0,
    },
    triggerHF: {
      type: String,
      required: true,
      match: /^\d+$/, // Only digits for BigNumber string
    },
    // Full sell specific fields
    token: {
      type: String,
      required: true,
      match: /^0x[a-fA-F0-9]{40}$/, // Ethereum address validation
    },
    percentOfEquity: {
      type: String,
      required: true,
      match: /^\d+$/, // Only digits for BigNumber string
    },
    v: {
      type: Number,
      required: true,
      min: 0,
      max: 255,
    },
    r: {
      type: String,
      required: true,
      match: /^0x[a-fA-F0-9]{64}$/, // 32 bytes hex string
    },
    s: {
      type: String,
      required: true,
      match: /^0x[a-fA-F0-9]{64}$/, // 32 bytes hex string
    },
  },
  { _id: false }
);

// Partial Sell Order Schema
const PartialSellOrderSchema = new Schema(
  {
    // Flattened order title fields
    debt: {
      type: String,
      required: true,
      match: /^0x[a-fA-F0-9]{40}$/, // Ethereum address validation
    },
    debtNonce: {
      type: Number,
      required: true,
      min: 0,
    },
    startTime: {
      type: Number,
      required: true,
      min: 0,
    },
    endTime: {
      type: Number,
      required: true,
      min: 0,
    },
    triggerHF: {
      type: String,
      required: true,
      match: /^\d+$/, // Only digits for BigNumber string
    },
    // Partial sell specific fields
    interestRateMode: {
      type: Number,
      required: true,
      enum: [1, 2], // 1 for stable, 2 for variable
    },
    collateralOut: {
      type: String,
      required: true,
      match: /^0x[a-fA-F0-9]{40}$/, // Ethereum address validation
    },
    repayToken: {
      type: String,
      required: true,
      match: /^0x[a-fA-F0-9]{40}$/, // Ethereum address validation
    },
    repayAmount: {
      type: String,
      required: true,
      match: /^\d+$/, // Only digits for BigNumber string
    },
    bonus: {
      type: String,
      required: true,
      match: /^\d+$/, // Only digits for BigNumber string
    },
    v: {
      type: Number,
      required: true,
      min: 0,
      max: 255,
    },
    r: {
      type: String,
      required: true,
      match: /^0x[a-fA-F0-9]{64}$/, // 32 bytes hex string
    },
    s: {
      type: String,
      required: true,
      match: /^0x[a-fA-F0-9]{64}$/, // 32 bytes hex string
    },
  },
  { _id: false }
);

// Main Order Schema
const OrderSchema = new Schema<IOrder>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderType: {
      type: String,
      enum: ["FULL", "PARTIAL"],
      required: true,
      index: true,
    },
    chainId: {
      type: Number,
      required: true,
      index: true,
    },
    contractAddress: {
      type: String,
      required: true,
      match: /^0x[a-fA-F0-9]{40}$/, // Ethereum address validation
      index: true,
    },
    seller: {
      type: String,
      required: true,
      match: /^0x[a-fA-F0-9]{40}$/, // Ethereum address validation
      index: true,
    },

    // Order data - exactly one must be populated based on orderType
    fullSellOrder: {
      type: FullSellOrderSchema,
      required: function () {
        return this.orderType === "FULL";
      },
    },
    partialSellOrder: {
      type: PartialSellOrderSchema,
      required: function () {
        return this.orderType === "PARTIAL";
      },
    },

    // Order status
    status: {
      type: String,
      enum: ["ACTIVE", "EXECUTED", "CANCELLED", "EXPIRED"],
      required: true,
      default: "ACTIVE",
      index: true,
    },

    // Execution details
    buyer: {
      type: String,
      match: /^0x[a-fA-F0-9]{40}$/, // Ethereum address validation
      index: true,
    },
    txHash: {
      type: String,
      match: /^0x[a-fA-F0-9]{64}$/, // Transaction hash validation
    },
    blockNumber: {
      type: String,
      index: true,
    },

    // Cancellation details
    cancelledAt: {
      type: Date,
      index: true,
    },
    cancelReason: {
      type: String,
    },

    // Computed fields for easy querying
    debtAddress: {
      type: String,
      required: true,
      match: /^0x[a-fA-F0-9]{40}$/, // Ethereum address validation
      index: true,
    },
    debtNonce: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      required: true,
      index: true,
    },
    triggerHF: {
      type: String,
      required: true,
      match: /^\d+$/, // Only digits for BigNumber string
    },
  },
  {
    timestamps: true,
    collection: "orders",
  }
);

// Custom validation to ensure exactly one order type is populated
OrderSchema.pre("validate", function (next) {
  const hasFullOrder = !!this.fullSellOrder;
  const hasPartialOrder = !!this.partialSellOrder;

  if (this.orderType === "FULL") {
    if (!hasFullOrder) {
      return next(
        new Error("Full sell order data is required for FULL order type")
      );
    }
    if (hasPartialOrder) {
      return next(
        new Error("Partial sell order data must be null for FULL order type")
      );
    }
  } else if (this.orderType === "PARTIAL") {
    if (!hasPartialOrder) {
      return next(
        new Error("Partial sell order data is required for PARTIAL order type")
      );
    }
    if (hasFullOrder) {
      return next(
        new Error("Full sell order data must be null for PARTIAL order type")
      );
    }
  }

  next();
});

// Indexes for better query performance
OrderSchema.index({ seller: 1, status: 1 });
OrderSchema.index({ debtAddress: 1, status: 1 });
OrderSchema.index({ debtAddress: 1, debtNonce: 1 });
OrderSchema.index({ status: 1, endTime: 1 });
OrderSchema.index({ chainId: 1, contractAddress: 1 });
OrderSchema.index({ orderType: 1, status: 1 });

// Pre-validate middleware to populate computed fields (runs before validation)
OrderSchema.pre("validate", function (next) {
  if (this.orderType === "FULL" && this.fullSellOrder) {
    this.debtAddress = this.fullSellOrder.debt;
    this.debtNonce = this.fullSellOrder.debtNonce;
    this.startTime = new Date(this.fullSellOrder.startTime * 1000);
    this.endTime = new Date(this.fullSellOrder.endTime * 1000);
    this.triggerHF = this.fullSellOrder.triggerHF;
  } else if (this.orderType === "PARTIAL" && this.partialSellOrder) {
    this.debtAddress = this.partialSellOrder.debt;
    this.debtNonce = this.partialSellOrder.debtNonce;
    this.startTime = new Date(this.partialSellOrder.startTime * 1000);
    this.endTime = new Date(this.partialSellOrder.endTime * 1000);
    this.triggerHF = this.partialSellOrder.triggerHF;
  }
  next();
});

// Pre-save middleware to populate computed fields
OrderSchema.pre("save", function (next) {
  if (this.orderType === "FULL" && this.fullSellOrder) {
    this.debtAddress = this.fullSellOrder.debt;
    this.debtNonce = this.fullSellOrder.debtNonce;
    this.startTime = new Date(this.fullSellOrder.startTime * 1000);
    this.endTime = new Date(this.fullSellOrder.endTime * 1000);
    this.triggerHF = this.fullSellOrder.triggerHF;
  } else if (this.orderType === "PARTIAL" && this.partialSellOrder) {
    this.debtAddress = this.partialSellOrder.debt;
    this.debtNonce = this.partialSellOrder.debtNonce;
    this.startTime = new Date(this.partialSellOrder.startTime * 1000);
    this.endTime = new Date(this.partialSellOrder.endTime * 1000);
    this.triggerHF = this.partialSellOrder.triggerHF;
  }
  next();
});

// Virtual to check if order is expired
OrderSchema.virtual("isExpired").get(function () {
  return this.status === "ACTIVE" && new Date() > this.endTime;
});

// Method to check if order is valid for execution
OrderSchema.methods.canExecute = function (): boolean {
  return (
    this.status === "ACTIVE" &&
    new Date() >= this.startTime &&
    new Date() <= this.endTime
  );
};

// Static method to find active orders
OrderSchema.statics.findActiveOrders = function (filters = {}) {
  return this.find({
    status: "ACTIVE",
    startTime: { $lte: new Date() },
    endTime: { $gte: new Date() },
    ...filters,
  });
};

// Static method to find orders by debt address
OrderSchema.statics.findByDebtAddress = function (debtAddress: string) {
  return this.find({ debtAddress });
};

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
