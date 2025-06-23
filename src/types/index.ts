// User entity from subgraph
export interface SubgraphUser {
  id: string;
  totalPositions: string;
  totalOrdersExecuted: string;
  totalVolumeTraded: string;
}

// Debt position entity from subgraph
export interface SubgraphDebtPosition {
  id: string;
  owner: {
    id: string;
  };
  nonce: string;
  collaterals: Array<{
    id: string;
    token: {
      id: string;
      symbol: string;
    };
    amount: string;
  }>;
  debts: Array<{
    id: string;
    token: {
      id: string;
      symbol: string;
    };
    amount: string;
    interestRateMode: string;
  }>;
  lastUpdatedAt: string;
}

// Order execution entity from subgraph (orders are off-chain)
export interface SubgraphOrder {
  id: string;
  position: {
    id: string;
  };
  buyer: {
    id: string;
  };
  seller: {
    id: string;
  };
  debtNonce: string;
  executionTime: string;
  blockNumber: string;
  gasUsed: string;
  gasPriceGwei: string;
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
