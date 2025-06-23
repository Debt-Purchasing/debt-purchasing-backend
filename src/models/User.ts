import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  id: string;
  totalPositions: string;
  totalOrdersExecuted: string;
  totalVolumeTraded: string;
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
    totalPositions: {
      type: String,
      required: true,
      default: '0',
    },
    totalOrdersExecuted: {
      type: String,
      required: true,
      default: '0',
    },
    totalVolumeTraded: {
      type: String,
      required: true,
      default: '0',
    },
  },
  {
    timestamps: true,
    collection: 'users',
  },
);

// Indexes for better query performance
UserSchema.index({ totalVolumeTraded: -1 });
UserSchema.index({ totalPositions: -1 });
UserSchema.index({ updatedAt: -1 });

export const User = mongoose.model<IUser>('User', UserSchema);
