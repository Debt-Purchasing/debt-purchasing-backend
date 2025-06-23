# Debt Purchasing Backend

A Node.js/Express backend service that caches subgraph data and provides a secure API for the debt purchasing frontend. This backend serves as a middleware layer to protect API keys and reduce direct subgraph API calls.

## 🏗️ Architecture

### Core Features

- **Subgraph Data Caching**: Periodic fetching (every 15-30s) from The Graph API
- **MongoDB Storage**: Efficient data storage with proper indexing
- **GraphQL Proxy**: Secure proxy for subgraph queries with hidden API keys
- **REST API**: Clean endpoints for cached data access
- **Background Jobs**: Automated data synchronization with cron jobs
- **Future-Ready**: Designed to support order book systems (like OpenSea/1inch)

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with middleware (CORS, compression, logging)
- **Database**: MongoDB with Mongoose ODM
- **Caching**: Interval-based background jobs with node-cron
- **Validation**: Zod for request/response validation
- **HTTP Client**: Axios for subgraph API calls

## 📦 Installation

```bash
# Navigate to backend directory
cd debt-purchasing-backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit environment variables
nano .env
```

## 🔧 Configuration

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3002
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=
MONGODB_DB_NAME=debt_purchasing

# Subgraph Configuration
SUBGRAPH_API_URL=
SUBGRAPH_API_KEY=

# Cache Configuration
CACHE_INTERVAL_SECONDS=30
CACHE_ENABLED=true

# API Configuration
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration (comma-separated origins)
CORS_ORIGINS=http://localhost:3000,http://localhost:3002
```

## 🚀 Usage

### Development

```bash
# Start development server with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint
```

### API Endpoints

#### Health Check

```http
GET /api/health
```

Returns server health status, database connection, and cache statistics.

#### GraphQL Proxy

```http
POST /api/subgraph
Content-Type: application/json

{
  "query": "{ users(first: 5) { id totalPositions } }",
  "variables": {},
  "operationName": "GetUsers"
}
```

#### Cached Data Endpoints

```http
# Get cached users
GET /api/users?limit=100&offset=0

# Get cached debt positions
GET /api/positions?limit=100&offset=0&owner=0x123...

# Get cached orders
GET /api/orders?limit=100&offset=0&executed=false&orderType=FULL

# Get cache statistics
GET /api/stats
```

## 🏛️ Database Schema

### Users Collection

```typescript
{
  id: string,              // User wallet address
  totalPositions: string,  // Total debt positions created
  totalOrdersExecuted: string,
  totalVolumeTraded: string,
  createdAt: Date,
  updatedAt: Date
}
```

### Debt Positions Collection

```typescript
{
  id: string,              // Position ID
  owner: string,           // Owner wallet address
  nonce: string,           // Position nonce
  collaterals: [{
    id: string,
    token: string,         // Token address
    amount: string         // Amount in wei
  }],
  debts: [{
    id: string,
    token: string,
    amount: string
  }],
  healthFactor: string,    // Current health factor
  createdAt: Date,
  updatedAt: Date
}
```

### Orders Collection

```typescript
{
  id: string,              // Order ID
  position: string,        // Position ID
  seller: string,          // Seller wallet address
  buyer?: string,          // Buyer wallet address (if executed)
  orderType: 'FULL' | 'PARTIAL',
  targetHealthFactor?: string,
  equityPercentage?: string,
  minPrice: string,
  validUntil: string,
  executed: boolean,
  cancelled: boolean,
  createdAt: Date,
  executedAt?: Date,
  updatedAt: Date
}
```

## 🔄 Data Flow

1. **Background Cache Service** fetches data from subgraph every 30 seconds
2. **Data Processing** transforms GraphQL responses to MongoDB documents
3. **Bulk Operations** efficiently update MongoDB with upsert operations
4. **API Endpoints** serve cached data to frontend with pagination
5. **GraphQL Proxy** provides secure access to live subgraph queries

## 🔒 Security Features

- **API Key Protection**: Subgraph API key stored securely on backend
- **CORS Configuration**: Restricted origins for frontend access
- **Request Validation**: Input validation with TypeScript types
- **Error Handling**: Comprehensive error responses with proper status codes
- **Rate Limiting**: Configurable rate limiting for API protection

## 🌐 Frontend Integration

Update your frontend subgraph client to use the backend API:

```typescript
// Before: Direct subgraph calls
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/...';

// After: Backend API calls
const BACKEND_URL = 'http://localhost:3002/api';

// Use /api/subgraph for GraphQL queries
// Use /api/users, /api/positions, /api/orders for cached data
```

## 🔮 Future Order Book Features

This backend is designed to support future order book functionality:

### Planned Features

- **WebSocket Support**: Real-time order book updates with Socket.io
- **Order Matching Engine**: Limit order processing and execution
- **Message Queue**: Redis/RabbitMQ for order processing pipeline
- **Authentication**: JWT-based user sessions for order management
- **Advanced Caching**: Redis for frequently accessed order book data

### Scalability Considerations

- **Horizontal Scaling**: Load balancer ready with stateless design
- **Database Optimization**: Proper indexing for order book queries
- **Caching Layer**: Multi-level caching for performance
- **Monitoring**: Health checks and metrics for production deployment

## 📊 Monitoring

The backend provides several monitoring endpoints:

- `/api/health` - Overall health status
- `/api/stats` - Cache statistics and database counts
- Database connection status and ping tests
- Automatic error logging with timestamps

## 🚦 Production Deployment

### Build for Production

```bash
npm run build
npm start
```

### Environment Variables

Ensure all production environment variables are properly set, especially:

- MongoDB connection string with proper credentials
- Production subgraph API key
- CORS origins for production domains
- Appropriate cache intervals for production load

### Process Management

Consider using PM2 for production process management:

```bash
npm install -g pm2
pm2 start dist/index.js --name debt-purchasing-backend
```

## 🤝 Contributing

1. Follow TypeScript best practices
2. Add proper error handling for all async operations
3. Include JSDoc comments for public methods
4. Update tests when adding new features
5. Ensure proper database indexing for new queries

## 📄 License

MIT License - see LICENSE file for details
