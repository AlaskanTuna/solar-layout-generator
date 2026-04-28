/**
 * Base application error with an HTTP status
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

/**
 * Error for 400 responses
 */
export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400)
  }
}

/**
 * Error for 403 responses
 */
export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403)
  }
}

/**
 * Error for 404 responses
 */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404)
  }
}
