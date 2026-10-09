import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import env from './config/env.js';
import routes from './routes/index.js';
import { apiLimiter } from './middleware/rateLimit.middleware.js';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';

const app = express();

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
app.use(
  cors({
    origin: [env.corsOrigin, 'http://localhost:5173', 'http://localhost:3000', '*'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global API rate limiting (map tiles are cached and high-volume)
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/map/')) return next();
  return apiLimiter(req, res, next);
});

// Main API routes
app.use('/api', routes);

// 404 Handler
app.use(notFoundHandler);

// Central error handler
app.use(errorHandler);

export default app;
