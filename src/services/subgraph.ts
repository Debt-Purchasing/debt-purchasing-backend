import axios, { AxiosInstance, AxiosResponse } from "axios";
import { config } from "../config";
import { GraphQLQuery, GraphQLResponse } from "../types";

export class SubgraphService {
  private static instance: SubgraphService;
  private endpoints: string[];
  private currentEndpointIndex: number = 0;

  private constructor() {
    // Initialize endpoints: primary + backup URLs
    this.endpoints = [config.subgraph.apiUrl, ...config.subgraph.backupUrls];

    console.log(
      `🔧 SubgraphService initialized with ${this.endpoints.length} endpoints:`,
      this.endpoints
    );
  }

  private createAxiosInstance(baseURL: string): AxiosInstance {
    const instance = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.subgraph.apiKey}`,
      },
    });

    // Add request/response interceptors for logging
    instance.interceptors.request.use(
      (config) => {
        console.log(
          `🔄 Subgraph Request to ${baseURL}: ${config.method?.toUpperCase()} ${
            config.url
          }`
        );
        return config;
      },
      (error) => {
        console.error("❌ Subgraph Request Error:", error);
        return Promise.reject(error);
      }
    );

    instance.interceptors.response.use(
      (response) => {
        console.log(`✅ Subgraph Response from ${baseURL}: ${response.status}`);
        return response;
      },
      (error) => {
        console.error(
          "❌ Subgraph Response Error from",
          baseURL,
          ":",
          error.response?.status,
          error.message
        );
        return Promise.reject(error);
      }
    );

    return instance;
  }

  public static getInstance(): SubgraphService {
    if (!SubgraphService.instance) {
      SubgraphService.instance = new SubgraphService();
    }
    return SubgraphService.instance;
  }

  public async executeQuery<T = any>(
    query: GraphQLQuery
  ): Promise<GraphQLResponse<T>> {
    const totalEndpoints = this.endpoints.length;
    let lastError: Error | null = null;

    // Try all endpoints starting from current index
    for (let i = 0; i < totalEndpoints; i++) {
      const endpointIndex = (this.currentEndpointIndex + i) % totalEndpoints;
      const endpoint = this.endpoints[endpointIndex];

      if (!endpoint) {
        console.error(`❌ Endpoint at index ${endpointIndex} is undefined`);
        continue;
      }

      try {
        console.log(
          `🔄 Trying endpoint ${
            endpointIndex + 1
          }/${totalEndpoints}: ${endpoint}`
        );

        const axiosInstance = this.createAxiosInstance(endpoint);
        const response: AxiosResponse<GraphQLResponse<T>> =
          await axiosInstance.post("", {
            query: query.query,
            variables: query.variables || {},
            operationName: query.operationName || "Subgraphs",
          });

        if (response.data.errors && response.data.errors.length > 0) {
          console.error("❌ GraphQL Errors:", response.data.errors);
        }

        // Success! Update current endpoint index for next time
        this.currentEndpointIndex = endpointIndex;
        console.log(
          `✅ Successfully used endpoint ${endpointIndex + 1}: ${endpoint}`
        );

        return response.data;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `❌ Failed to execute query on endpoint ${
            endpointIndex + 1
          } (${endpoint}):`,
          errorMessage
        );
        lastError = error instanceof Error ? error : new Error(errorMessage);

        // If this is the last endpoint, we'll throw the error
        if (i === totalEndpoints - 1) {
          break;
        }

        // Continue to next endpoint
        console.log(`🔄 Trying next endpoint...`);
      }
    }

    // All endpoints failed, throw the last error
    console.error("❌ All subgraph endpoints failed");
    throw new Error(
      `All subgraph endpoints failed. Last error: ${
        lastError?.message || "Unknown error"
      }`
    );
  }

  public async fetchUsers(first = 100, skip = 0): Promise<GraphQLResponse> {
    const query = `
      query GetUsers($first: Int!, $skip: Int!) {
        users(first: $first, skip: $skip, orderBy: lastUpdatedAt, orderDirection: desc) {
          id
          nonce
          totalPositions
          totalOrdersExecuted
          totalVolumeUSD
          lastUpdatedAt
        }
      }
    `;

    return this.executeQuery({
      query,
      variables: { first, skip },
      operationName: "GetUsers",
    });
  }

  public async fetchDebtPositions(
    first = 100,
    skip = 0
  ): Promise<GraphQLResponse> {
    const query = `
      query GetDebtPositions($first: Int!, $skip: Int!) {
        debtPositions(first: $first, skip: $skip, orderBy: lastUpdatedAt, orderDirection: desc) {
          id
          owner
          nonce
          collaterals {
            id
            token {
              id
              symbol
              decimals
            }
            amount
          }
          debts {
            id
            token {
              id
              symbol
              decimals
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
      operationName: "GetDebtPositions",
    });
  }

  public async fetchFullOrderExecutions(
    first = 100,
    skip = 0
  ): Promise<GraphQLResponse> {
    // Orders are off-chain, so fetch order executions instead
    const query = `
      query GetFullOrderExecutions($first: Int!, $skip: Int!) {
        fullOrderExecutions(first: $first, skip: $skip, orderBy: blockTimestamp, orderDirection: desc) {
          id,
          titleHash,
          buyer,
          usdValue,
          usdBonus,
          blockTimestamp,
          blockNumber
        }
      }
    `;

    return this.executeQuery({
      query,
      variables: { first, skip },
      operationName: "GetFullOrderExecutions",
    });
  }

  public async fetchPartialOrderExecutions(
    first = 100,
    skip = 0
  ): Promise<GraphQLResponse> {
    const query = `
      query GetPartialOrderExecutions($first: Int!, $skip: Int!) {
        partialOrderExecutions(first: $first, skip: $skip, orderBy: blockTimestamp, orderDirection: desc) {
          id,
          titleHash,
          buyer,
          usdValue,
          usdBonus,
          blockTimestamp,
          blockNumber
        } 
      }
    `;

    return this.executeQuery({
      query,
      variables: { first, skip },
      operationName: "GetPartialOrderExecutions",
    });
  }

  public async fetchPriceTokens(
    first = 100,
    skip = 0
  ): Promise<GraphQLResponse> {
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
      operationName: "GetPriceTokens",
    });
  }

  public async fetchLiquidationThresholds(
    first = 100,
    skip = 0
  ): Promise<GraphQLResponse> {
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
      operationName: "QueryLiquidationThreshold",
    });
  }

  public async fetchCancelledOrders(
    first = 100,
    skip = 0
  ): Promise<GraphQLResponse> {
    const query = `
      query GetCancelledOrders($first: Int!, $skip: Int!) {
        cancelledOrders(first: $first, skip: $skip, orderBy: cancelledAt, orderDirection: desc) {
          id
          titleHash
          cancelledAt
        }
      }
    `;

    return this.executeQuery({
      query,
      variables: { first, skip },
      operationName: "GetCancelledOrders",
    });
  }

  public async fetchProtocolMetrics(): Promise<GraphQLResponse> {
    const query = `
      query GetProtocolMetrics {
        protocolMetrics(id: "protocol") {
          id
          totalPositions
          totalUsers
          fullOrdersUSD
          partialOrdersUSD
          collaterals {
            id
            token {
              id
              symbol
              decimals
            }
            amount
          }
          debts {
            id
            token {
              id
              symbol
              decimals
            }
            amount
          }
          lastUpdatedAt
        }
      }
    `;

    return this.executeQuery({
      query,
      operationName: "GetProtocolMetrics",
    });
  }

  public async fetchAllData(): Promise<{
    users: GraphQLResponse;
    debtPositions: GraphQLResponse;
    fullOrderExecutions: GraphQLResponse;
    partialOrderExecutions: GraphQLResponse;
    priceTokens: GraphQLResponse;
    liquidationThresholds: GraphQLResponse;
    cancelledOrders: GraphQLResponse;
    protocolMetrics: GraphQLResponse;
  }> {
    try {
      const [
        users,
        debtPositions,
        fullOrderExecutions,
        partialOrderExecutions,
        priceTokens,
        liquidationThresholds,
        cancelledOrders,
        protocolMetrics,
      ] = await Promise.all([
        this.fetchUsers(),
        this.fetchDebtPositions(),
        this.fetchFullOrderExecutions(),
        this.fetchPartialOrderExecutions(),
        this.fetchPriceTokens(),
        this.fetchLiquidationThresholds(),
        this.fetchCancelledOrders(),
        this.fetchProtocolMetrics(),
      ]);

      return {
        users,
        debtPositions,
        fullOrderExecutions,
        partialOrderExecutions,
        priceTokens,
        liquidationThresholds,
        cancelledOrders,
        protocolMetrics,
      };
    } catch (error) {
      console.error("❌ Failed to fetch all subgraph data:", error);
      throw error;
    }
  }
}

export default SubgraphService;
