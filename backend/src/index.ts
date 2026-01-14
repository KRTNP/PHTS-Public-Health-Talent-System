/**
 * PHTS System - Main Server Entry Point
 *
 * Express server with authentication, CORS, and security middleware
 *
 * Date: 2025-12-30
 */

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { testConnection, closePool } from './config/database.js';
import { initializePassport } from './config/passport.js';
import authRoutes from './modules/auth/auth.routes.js';
import requestRoutes from './modules/request/request.routes.js';
import signatureRoutes from './modules/signature/signature.routes.js';
import payrollRoutes from './modules/payroll/payroll.routes.js';
import reportRoutes from './modules/report/report.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import notificationRoutes from './modules/notification/notification.routes.js';
import financeRoutes from './modules/finance/finance.routes.js';
// Phase 6: Compliance & Quality
import auditRoutes from './modules/audit/audit.routes.js';
import slaRoutes from './modules/sla/sla.routes.js';
import accessReviewRoutes from './modules/access-review/access-review.routes.js';
import delegationRoutes from './modules/delegation/delegation.routes.js';
import dataQualityRoutes from './modules/data-quality/data-quality.routes.js';
import snapshotRoutes from './modules/snapshot/snapshot.routes.js';
import { ApiResponse } from './types/auth.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Application = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Security Middleware
 */
app.use(helmet());

// Allow CORS for configured origins (comma-separated env support for multiple frontends)
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      const isAllowed =
        !origin ||
        allowedOrigins.some(
          (allowed) => origin === allowed || origin.startsWith(`${allowed}/`),
        );

      if (isAllowed) {
        return callback(null, true);
      }

      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

/**
 * Body Parser Middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Logging Middleware
 * Use 'combined' format in production, 'dev' format in development
 */
if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

/**
 * Initialize Passport for JWT authentication
 */
app.use(initializePassport());

/**
 * Health Check Route
 */
app.get('/health', (_req: Request, res: Response<ApiResponse>) => {
  res.status(200).json({
    success: true,
    message: 'PHTS API is running',
    data: {
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      port: PORT,
    },
  });
});

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/system', adminRoutes);
app.use('/api/management', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/finance', financeRoutes);
// Phase 6: Compliance & Quality Routes
app.use('/api/audit', auditRoutes);
app.use('/api/sla', slaRoutes);
app.use('/api/access-review', accessReviewRoutes);
app.use('/api/delegations', delegationRoutes);
app.use('/api/data-quality', dataQualityRoutes);
app.use('/api/snapshots', snapshotRoutes);

/**
 * 404 Handler - Route Not Found
 */
app.use(notFoundHandler);

/**
 * Global Error Handler
 * Catches all errors thrown in the application
 */
app.use(errorHandler);

/**
 * Start server and verify database connectivity before accepting requests
 */
async function startServer() {
  try {
    // Verify database connectivity
    console.log('[Server] Verifying database connection...');
    await testConnection();

    // Start Express server
    app.listen(PORT, () => {
      console.log(
        `[Server] PHTS Backend started on port ${PORT} (${process.env.NODE_ENV})`,
      );
      console.log(`[Server] Database host: ${process.env.DB_HOST || 'localhost'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful Shutdown
 * Close database connections before exiting
 */
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    await closePool();
    console.log('Server shut down successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle process termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server
if (NODE_ENV !== 'test') {
  startServer();
}

export default app;
