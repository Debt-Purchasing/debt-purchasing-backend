import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config';
import DatabaseService from './services/database';
import SubgraphCacheService from './services/cache';
import apiRoutes from './routes';

const app = express();

// Middleware
app.use(morgan('combined'));
app.use(compression());
app.use(
  cors({
    origin: config.cors.origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Debt Purchasing Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🔄 Received ${signal}, starting graceful shutdown...`);

  try {
    // Stop cache service
    const cacheService = SubgraphCacheService.getInstance();
    cacheService.stopCaching();

    // Disconnect database
    const dbService = DatabaseService.getInstance();
    await dbService.disconnect();

    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle process signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Initialize and start server
async function startServer() {
  try {
    console.log('🚀 Starting Debt Purchasing Backend...');

    // Connect to database (non-blocking in development)
    const dbService = DatabaseService.getInstance();
    try {
      await dbService.connect();
    } catch (error) {
      console.log('⚠️  Database connection failed - continuing without database for development');
      console.log('💡 To fix: Set up MongoDB or create a .env file with proper MONGODB_URI');
    }

    // Start cache service
    const cacheService = SubgraphCacheService.getInstance();
    await cacheService.startCaching();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      console.log(`✅ Server running on port ${config.port}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`📊 Cache interval: ${config.cache.intervalSeconds}s`);
      console.log(`🔗 CORS origins: ${config.cors.origins.join(', ')}`);
      console.log(`\n🎯 API Endpoints:`);
      console.log(`   GET  /api/health       - Health check`);
      console.log(`   POST /api/subgraph     - GraphQL proxy`);
      console.log(`   GET  /api/users        - Cached users`);
      console.log(`   GET  /api/positions    - Cached positions`);
      console.log(`   GET  /api/orders       - Cached orders`);
      console.log(`   GET  /api/stats        - Cache statistics`);
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${config.port} is already in use`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
