import mongoose, { Document, Schema } from 'mongoose';

export interface IAssetConfiguration extends Document {
  id: string;
  symbol: string;
  liquidationThreshold: string;
  liquidationBonus: string;
  reserveFactor: string;
  isActive: boolean;
  lastUpdatedAt: string;
  createdAt: Date;
  updatedAt: Date;
}

const AssetConfigurationSchema = new Schema<IAssetConfiguration>(
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
    liquidationThreshold: {
      type: String,
      required: true,
      index: true,
    },
    liquidationBonus: {
      type: String,
      required: true,
      index: true,
    },
    reserveFactor: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      index: true,
    },
    lastUpdatedAt: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'asset_configurations',
  },
);

// Indexes for better query performance
AssetConfigurationSchema.index({ symbol: 1, isActive: 1 });
AssetConfigurationSchema.index({ liquidationThreshold: -1 });
AssetConfigurationSchema.index({ lastUpdatedAt: -1 });
AssetConfigurationSchema.index({ isActive: 1, updatedAt: -1 });

export const AssetConfiguration = mongoose.model<IAssetConfiguration>('AssetConfiguration', AssetConfigurationSchema);
