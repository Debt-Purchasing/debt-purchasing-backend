import mongoose, { Document, Schema } from "mongoose";

export interface ICollateral {
  id: string;
  token: string;
  symbol: string;
  decimals: number;
  amount: string;
  lastUpdatedAt: Date;
}

export interface IDebt {
  id: string;
  token: string;
  symbol: string;
  decimals: number;
  amount: string;
  interestRateMode: string;
  lastUpdatedAt: Date;
}

export interface IDebtPosition extends Document {
  id: string;
  owner: string;
  nonce: number;
  collaterals: ICollateral[];
  debts: IDebt[];
  createdAt: Date;
  updatedAt: Date;
}

const CollateralSchema = new Schema<ICollateral>(
  {
    id: { type: String, required: true },
    token: { type: String, required: true },
    symbol: { type: String, required: true },
    decimals: { type: Number, required: true },
    amount: { type: String, required: true },
    lastUpdatedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const DebtSchema = new Schema<IDebt>(
  {
    id: { type: String, required: true },
    token: { type: String, required: true },
    symbol: { type: String, required: true },
    decimals: { type: Number, required: true },
    amount: { type: String, required: true },
    interestRateMode: { type: String, required: true },
    lastUpdatedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const DebtPositionSchema = new Schema<IDebtPosition>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    owner: {
      type: String,
      required: true,
      index: true,
    },
    nonce: {
      type: Number,
      required: true,
      default: 0,
    },
    collaterals: [CollateralSchema],
    debts: [DebtSchema],
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "debt_positions",
  }
);

// Indexes for better query performance
DebtPositionSchema.index({ owner: 1, updatedAt: -1 });
DebtPositionSchema.index({ "collaterals.token": 1 });
DebtPositionSchema.index({ "debts.token": 1 });

export const DebtPosition = mongoose.model<IDebtPosition>(
  "DebtPosition",
  DebtPositionSchema
);
