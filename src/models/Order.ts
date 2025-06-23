import mongoose, { Document, Schema } from 'mongoose';

export interface IOrder extends Document {
  id: string;
  position: string;
  seller: string;
  buyer?: string;
  orderType: 'FULL' | 'PARTIAL';
  targetHealthFactor?: string;
  equityPercentage?: string;
  minPrice: string;
  validUntil: string;
  executed: boolean;
  cancelled: boolean;
  createdAt: Date;
  executedAt?: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    position: {
      type: String,
      required: true,
      index: true,
    },
    seller: {
      type: String,
      required: true,
      index: true,
    },
    buyer: {
      type: String,
      index: true,
    },
    orderType: {
      type: String,
      enum: ['FULL', 'PARTIAL'],
      required: true,
      index: true,
    },
    targetHealthFactor: {
      type: String,
    },
    equityPercentage: {
      type: String,
    },
    minPrice: {
      type: String,
      required: true,
    },
    validUntil: {
      type: String,
      required: true,
      index: true,
    },
    executed: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    cancelled: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    executedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'orders',
  },
);

// Indexes for better query performance
OrderSchema.index({ seller: 1, executed: 1, cancelled: 1 });
OrderSchema.index({ executed: 1, cancelled: 1, validUntil: 1 });
OrderSchema.index({ orderType: 1, executed: 1 });
OrderSchema.index({ position: 1, executed: 1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
