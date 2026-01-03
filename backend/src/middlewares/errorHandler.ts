import type { NextFunction, Request, Response } from 'express';

interface AppError extends Error {
  statusCode?: number;
}

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  });
};

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const isProd = process.env.NODE_ENV === 'production';
  const message = isProd ? 'An internal server error occurred' : err.message;

  // Basic logging; can be replaced with external alerting
  // eslint-disable-next-line no-console
  console.error('Error:', err.stack || err);

  res.status(status).json({
    success: false,
    error: message,
  });
};
