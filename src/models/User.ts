import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  id: string;
  nonce: string;
  totalPositions: string;
  totalOrdersExecuted: string;
  totalVolumeUSD: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    nonce: {
      type: String,
      required: true,
      default: "0",
    },
    totalPositions: {
      type: String,
      required: true,
      default: "0",
    },
    totalOrdersExecuted: {
      type: String,
      required: true,
      default: "0",
    },
    totalVolumeUSD: {
      type: String,
      required: true,
      default: "0",
    },
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
    collection: "users",
  }
);

// Indexes for better query performance
UserSchema.index({ nonce: -1 });
UserSchema.index({ updatedAt: -1 });

export const User = mongoose.model<IUser>("User", UserSchema);
