// Use when a request should fail with a specific HTTP status.
class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}

module.exports = AppError;
