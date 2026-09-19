/**
 * Custom Error Classes
 * For better error handling and consistent error responses
 */

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Error handler middleware
 * Handles all errors and sends consistent error responses
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Some Node/pg errors (e.g. AggregateError) can have an empty message.
  if (!error.message && Array.isArray(err?.errors) && err.errors[0]?.message) {
    error.message = err.errors[0].message;
  }

  if (!error.message && err?.code === 'ECONNREFUSED') {
    error.message = 'Database connection refused. Is Postgres running and DATABASE_URL correct?';
  }

  // Query timeout errors
  if (err.name === 'QueryTimeoutError' || err.message?.includes('timeout')) {
    error = new AppError('Database query timed out. Please try again.', 500);
    error.name = 'QueryTimeoutError';
  }

  // Log error with full details
  console.error('========== ERROR ==========');
  console.error('Error message:', err.message);
  console.error('Error name:', err.name);
  console.error('Error code:', err.code);
  console.error('Error stack:', err.stack);
  console.error('Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  console.error('===========================');

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new NotFoundError();
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new ValidationError(message);
  }

  // Mongoose validation error (only if errors object exists)
  if (err.name === 'ValidationError' && err.errors && typeof err.errors === 'object') {
    try {
      const message = Object.values(err.errors).map((val) => val.message).join(', ');
      error = new ValidationError(message);
    } catch (e) {
      // If Object.values fails, just use the error message
      error = new ValidationError(err.message || 'Validation error');
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AuthenticationError('Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AuthenticationError('Token expired');
  }

  if (err.type === 'entity.too.large' || err.status === 413) {
    error = new AppError(
      'Request payload is too large. Try uploading fewer images at once or use smaller image files.',
      413,
    );
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  errorHandler,
};

