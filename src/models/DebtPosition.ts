import mongoose, { Document, Schema } from "mongoose";

export interface ICollateral {
  id: string;
  token: string;
  amount: string;
}

export interface IDebt {
  id: string;
  token: string;
  amount: string;
  interestRateMode: string;
}

export interface IDebtPosition extends Document {
  id: string;
  owner: string;
  nonce: string;
  collaterals: ICollateral[];
  debts: IDebt[];
  createdAt: Date;
  updatedAt: Date;
}

const CollateralSchema = new Schema<ICollateral>(
  {
    id: { type: String, required: true },
    token: { type: String, required: true },
    amount: { type: String, required: true },
  },
  { _id: false }
);

const DebtSchema = new Schema<IDebt>(
  {
    id: { type: String, required: true },
    token: { type: String, required: true },
    amount: { type: String, required: true },
    interestRateMode: { type: String, required: true },
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
      type: String,
      required: true,
    },
    collaterals: [CollateralSchema],
    debts: [DebtSchema],
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
