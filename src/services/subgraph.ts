import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '../config';
import { GraphQLQuery, GraphQLResponse } from '../types';

export class SubgraphService {
  private static instance: SubgraphService;
  private axiosInstance: AxiosInstance;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: config.subgraph.apiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.subgraph.apiKey}`,
      },
    });

    // Add request/response interceptors for logging
    this.axiosInstance.interceptors.request.use(
      config => {
        console.log(`🔄 Subgraph Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      error => {
        console.error('❌ Subgraph Request Error:', error);
        return Promise.reject(error);
      },
    );

    this.axiosInstance.interceptors.response.use(
      response => {
        console.log(`✅ Subgraph Response: ${response.status}`);
        return response;
      },
      error => {
        console.error('❌ Subgraph Response Error:', error.response?.status, error.message);
        return Promise.reject(error);
      },
    );
  }

  public static getInstance(): SubgraphService {
    if (!SubgraphService.instance) {
      SubgraphService.instance = new SubgraphService();
    }
    return SubgraphService.instance;
  }

  public async executeQuery<T = any>(query: GraphQLQuery): Promise<GraphQLResponse<T>> {
    try {
      const response: AxiosResponse<GraphQLResponse<T>> = await this.axiosInstance.post('', {
        query: query.query,
        variables: query.variables || {},
        operationName: query.operationName || 'Subgraphs',
      });

      if (response.data.errors && response.data.errors.length > 0) {
        console.error('❌ GraphQL Errors:', response.data.errors);
      }

      return response.data;
    } catch (error) {
      console.error('❌ Failed to execute subgraph query:', error);
      throw new Error(`Subgraph query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async fetchUsers(first = 100, skip = 0): Promise<GraphQLResponse> {
    const query = `
      query GetUsers($first: Int!, $skip: Int!) {
        users(first: $first, skip: $skip, orderBy: totalVolumeTraded, orderDirection: desc) {
          id
          totalPositions
          totalOrdersExecuted
          totalVolumeTraded
        }
      }
    `;

    return this.executeQuery({
      query,
      variables: { first, skip },
      operationName: 'GetUsers',
    });
  }

  public async fetchDebtPositions(first = 100, skip = 0): Promise<GraphQLResponse> {
    const query = `
      query GetDebtPositions($first: Int!, $skip: Int!) {
        debtPositions(first: $first, skip: $skip, orderBy: lastUpdatedAt, orderDirection: desc) {
          id
          owner {
            id
          }
          nonce
          collaterals {
            id
            token {
              id
              symbol
            }
            amount
          }
          debts {
            id
            token {
              id
              symbol
            }
            amount
            interestRateMode
          }
          lastUpdatedAt
        }
      }
    `;

    return this.executeQuery({
      query,
      variables: { first, skip },
      operationName: 'GetDebtPositions',
    });
  }

  public async fetchOrders(first = 100, skip = 0): Promise<GraphQLResponse> {
    // Orders are off-chain, so fetch order executions instead
    const query = `
      query GetOrderExecutions($first: Int!, $skip: Int!) {
        fullSaleOrderExecutions(first: $first, skip: $skip, orderBy: executionTime, orderDirection: desc) {
          id
          position {
            id
          }
          buyer {
            id
          }
          seller {
            id
          }
          debtNonce
          executionTime
          blockNumber
          gasUsed
          gasPriceGwei
        }
      }
    `;

    return this.executeQuery({
      query,
      variables: { first, skip },
      operationName: 'GetOrderExecutions',
    });
  }

  public async fetchPriceTokens(first = 100, skip = 0): Promise<GraphQLResponse> {
    const query = `
      query GetPriceTokens($first: Int!, $skip: Int!) {
        tokens(first: $first, skip: $skip, orderBy: lastUpdatedAt, orderDirection: desc) {
          id
          symbol
          decimals
          priceUSD
          oracleSource
          lastUpdatedAt
        }
      }
    `;

    return this.executeQuery({
      query,
      variables: { first, skip },
      operationName: 'GetPriceTokens',
    });
  }

  public async fetchLiquidationThresholds(first = 100, skip = 0): Promise<GraphQLResponse> {
    const query = `
      query QueryLiquidationThreshold($first: Int!, $skip: Int!) {
        assetConfigurations(first: $first, skip: $skip, orderBy: lastUpdatedAt, orderDirection: desc) {
          liquidationThreshold
          liquidationBonus
          lastUpdatedAt
          isActive
          id
          symbol
          reserveFactor
        }
      }
    `;

    return this.executeQuery({
      query,
      variables: { first, skip },
      operationName: 'QueryLiquidationThreshold',
    });
  }

  public async fetchAllData(): Promise<{
    users: GraphQLResponse;
    debtPositions: GraphQLResponse;
    orders: GraphQLResponse;
    priceTokens: GraphQLResponse;
    liquidationThresholds: GraphQLResponse;
  }> {
    try {
      const [users, debtPositions, orderExecutions, priceTokens, liquidationThresholds] = await Promise.all([
        this.fetchUsers(),
        this.fetchDebtPositions(),
        this.fetchOrders(), // This now fetches order executions
        this.fetchPriceTokens(),
        this.fetchLiquidationThresholds(),
      ]);

      return { users, debtPositions, orders: orderExecutions, priceTokens, liquidationThresholds };
    } catch (error) {
      console.error('❌ Failed to fetch all subgraph data:', error);
      throw error;
    }
  }
}

export default SubgraphService;
