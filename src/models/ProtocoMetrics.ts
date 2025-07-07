import mongoose, { Document, Schema } from "mongoose";

export interface IProtocolCollateral {
  id: string;
  token: string;
  amount: string;
  lastUpdatedAt: Date;
}
export interface IProtocolDebt {
  id: string;
  token: string;
  amount: string;
  lastUpdatedAt: Date;
}

export interface IProtocolMetrics extends Document {
  id: string;
  totalPositions: string;
  totalUsers: string;
  fullOrdersUSD: string;
  partialOrdersUSD: string;
  collaterals: IProtocolCollateral[];
  debts: IProtocolDebt[];
  lastUpdatedAt: Date;
}

const CollateralSchema = new Schema<IProtocolCollateral>(
  {
    id: { type: String, required: true },
    token: { type: String, required: true },
    amount: { type: String, required: true },
    lastUpdatedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const DebtSchema = new Schema<IProtocolDebt>(
  {
    id: { type: String, required: true },
    token: { type: String, required: true },
    amount: { type: String, required: true },
    lastUpdatedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const ProtocolMetricsSchema = new Schema<IProtocolMetrics>(
  {
    id: { type: String, required: true },
    totalPositions: { type: String, required: true },
    totalUsers: { type: String, required: true },
    fullOrdersUSD: { type: String, required: true },
    partialOrdersUSD: { type: String, required: true },
    collaterals: { type: [CollateralSchema], required: true },
    debts: { type: [DebtSchema], required: true },
    lastUpdatedAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
    collection: "protocol_metrics",
  }
);

export default mongoose.model<IProtocolMetrics>(
  "ProtocolMetrics",
  ProtocolMetricsSchema
);
