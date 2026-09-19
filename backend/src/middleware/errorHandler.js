const { errorHandler } = require('../utils/errors');

/**
 * Error Handler Middleware
 * Must be the last middleware in the chain
 */
module.exports = errorHandler;

