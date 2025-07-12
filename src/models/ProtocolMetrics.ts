import mongoose, { Document, Schema } from "mongoose";

// Protocol Collateral interface
export interface IProtocolCollateral {
  id: string; // token address
  token: string; // token address
  symbol: string;
  decimals: number;
  amount: string; // Total amount supplied across all positions
}

// Protocol Debt interface
export interface IProtocolDebt {
  id: string; // token address + interest rate mode
  token: string; // token address
  symbol: string;
  decimals: number;
  amount: string; // Total amount borrowed across all positions
}

// Main ProtocolMetrics document interface
export interface IProtocolMetrics extends Document {
  id: string; // Always "protocol"
  totalPositions: string; // Total number of debt positions
  totalUsers: string; // Total number of unique users
  fullOrdersUSD: string; // Total USD volume of full orders
  partialOrdersUSD: string; // Total USD volume of partial orders
  collaterals: IProtocolCollateral[]; // Aggregated collateral data
  debts: IProtocolDebt[]; // Aggregated debt data
  lastUpdatedAt: Date; // Last update timestamp
  createdAt: Date;
  updatedAt: Date;
}

// Protocol Collateral Schema
const ProtocolCollateralSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    token: {
      type: String,
      required: true,
      match: /^0x[a-fA-F0-9]{40}$/, // Ethereum address validation
    },
    symbol: {
      type: String,
      required: true,
    },
    decimals: {
      type: Number,
      required: true,
      min: 0,
      max: 18,
    },
    amount: {
      type: String,
      required: true,
      match: /^\d+(\.\d+)?$/, // Decimal format validation
    },
  },
  { _id: false }
);

// Protocol Debt Schema
const ProtocolDebtSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    token: {
      type: String,
      required: true,
      match: /^0x[a-fA-F0-9]{40}$/, // Ethereum address validation
    },
    symbol: {
      type: String,
      required: true,
    },
    decimals: {
      type: Number,
      required: true,
      min: 0,
      max: 18,
    },
    amount: {
      type: String,
      required: true,
      match: /^\d+(\.\d+)?$/, // Decimal format validation
    },
  },
  { _id: false }
);

// Main ProtocolMetrics Schema
const ProtocolMetricsSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      enum: ["protocol"], // Only allow "protocol" as id
    },
    totalPositions: {
      type: String,
      required: true,
      match: /^\d+$/, // Only digits for BigInt string
    },
    totalUsers: {
      type: String,
      required: true,
      match: /^\d+$/, // Only digits for BigInt string
    },
    fullOrdersUSD: {
      type: String,
      required: true,
      match: /^\d+(\.\d+)?$/, // Decimal format validation
    },
    partialOrdersUSD: {
      type: String,
      required: true,
      match: /^\d+(\.\d+)?$/, // Decimal format validation
    },
    collaterals: {
      type: [ProtocolCollateralSchema],
      default: [],
    },
    debts: {
      type: [ProtocolDebtSchema],
      default: [],
    },
    lastUpdatedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    collection: "protocolmetrics",
  }
);

// Create indexes for better query performance
ProtocolMetricsSchema.index({ id: 1 });
ProtocolMetricsSchema.index({ lastUpdatedAt: -1 });

// Export the model
export const ProtocolMetrics = mongoose.model<IProtocolMetrics>(
  "ProtocolMetrics",
  ProtocolMetricsSchema
);
