// Token entity from subgraph
export interface SubgraphToken {
  id: string;
  symbol: string;
  decimals: number;
  priceUSD: string;
  oracleSource: string;
  lastUpdatedAt: string;
}

// User entity from subgraph
export interface SubgraphUser {
  id: string;
  nonce: string;
  totalPositions: string;
  totalOrdersExecuted: string;
  totalVolumeUSD: string;
  lastUpdatedAt: string;
}

// Debt position entity from subgraph
export interface SubgraphDebtPosition {
  id: string;
  owner: string;
  nonce: string;
  collaterals: Array<{
    id: string;
    token: {
      id: string;
      symbol: string;
      decimals: number;
    };
    amount: string;
  }>;
  debts: Array<{
    id: string;
    token: {
      id: string;
      symbol: string;
      decimals: number;
    };
    amount: string;
    interestRateMode: string;
  }>;
  createdAt: string;
  lastUpdatedAt: string;
}

// Order execution entity from subgraph (orders are off-chain)
export interface SubgraphFullOrder {
  id: string;
  titleHash: string;
  buyer: string;
  usdValue: string; // Base value of the order in USD
  usdBonus: string; // Base bonus of the order in USD
  blockTimestamp: string;
  blockNumber: string;
}

export interface SubgraphPartialOrder {
  id: string;
  titleHash: string;
  buyer: string;
  usdValue: string; // Base value of the order in USD
  usdBonus: string; // Base bonus of the order in USD
  blockTimestamp: string;
  blockNumber: string;
}

// Cancelled order entity from subgraph
export interface SubgraphCancelledOrder {
  id: string;
  titleHash: string;
  cancelledAt: string;
}

// Asset configuration entity from subgraph
export interface SubgraphAssetConfiguration {
  id: string;
  symbol: string;
  liquidationThreshold: string;
  liquidationBonus: string;
  reserveFactor: string;
  isActive: boolean;
  lastUpdatedAt: string;
}

// GraphQL query types
export interface GraphQLQuery {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: string[];
  }>;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Environment configuration
export interface Config {
  port: number;
  nodeEnv: string;
  mongodb: {
    uri: string;
    dbName: string;
  };
  subgraph: {
    apiUrl: string;
    apiKey: string;
    backupUrls: string[];
  };
  cache: {
    intervalSeconds: number;
    enabled: boolean;
  };
  api: {
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
  cors: {
    origins: string[];
  };
}

// Protocol Metrics entity from subgraph
export interface SubgraphProtocolCollateral {
  id: string;
  token: {
    id: string;
    symbol: string;
    decimals: number;
  };
  amount: string;
}

export interface SubgraphProtocolDebt {
  id: string;
  token: {
    id: string;
    symbol: string;
    decimals: number;
  };
  amount: string;
}

export interface SubgraphProtocolMetrics {
  id: string; // Always "protocol"
  totalPositions: string;
  totalUsers: string;
  fullOrdersUSD: string;
  partialOrdersUSD: string;
  collaterals: SubgraphProtocolCollateral[];
  debts: SubgraphProtocolDebt[];
  lastUpdatedAt: string;
}
