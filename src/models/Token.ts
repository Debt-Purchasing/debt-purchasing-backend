import mongoose, { Document, Schema } from 'mongoose';

export interface IToken extends Document {
  id: string;
  symbol: string;
  decimals: number;
  priceUSD: string;
  oracleSource: string;
  lastUpdatedAt: string;
  createdAt: Date;
  updatedAt: Date;
}

const TokenSchema = new Schema<IToken>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      index: true,
    },
    decimals: {
      type: Number,
      required: true,
    },
    priceUSD: {
      type: String,
      required: true,
      index: true,
    },
    oracleSource: {
      type: String,
      required: true,
    },
    lastUpdatedAt: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'tokens',
  },
);

// Indexes for better query performance
TokenSchema.index({ symbol: 1, updatedAt: -1 });
TokenSchema.index({ priceUSD: -1 });
TokenSchema.index({ lastUpdatedAt: -1 });

export const Token = mongoose.model<IToken>('Token', TokenSchema);
