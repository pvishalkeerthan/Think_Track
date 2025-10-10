// Error handling utilities for better user experience

export class ThinkTrackError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = "ThinkTrackError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const ERROR_CODES = {
  // API Errors
  GEMINI_API_UNAVAILABLE: "GEMINI_API_UNAVAILABLE",
  GEMINI_API_OVERLOADED: "GEMINI_API_OVERLOADED",
  GEMINI_API_INVALID_RESPONSE: "GEMINI_API_INVALID_RESPONSE",

  // Database Errors
  DATABASE_CONNECTION_FAILED: "DATABASE_CONNECTION_FAILED",
  TEST_NOT_FOUND: "TEST_NOT_FOUND",
  USER_NOT_FOUND: "USER_NOT_FOUND",

  // Validation Errors
  INVALID_TEST_DETAILS: "INVALID_TEST_DETAILS",
  INVALID_QUESTIONS: "INVALID_QUESTIONS",
  INVALID_USER_ANSWERS: "INVALID_USER_ANSWERS",

  // Authentication Errors
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",

  // System Errors
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
};

export const ERROR_MESSAGES = {
  [ERROR_CODES.GEMINI_API_UNAVAILABLE]:
    "AI service is temporarily unavailable. Using fallback questions.",
  [ERROR_CODES.GEMINI_API_OVERLOADED]:
    "AI service is overloaded. Using fallback questions.",
  [ERROR_CODES.GEMINI_API_INVALID_RESPONSE]:
    "AI service returned invalid response. Using fallback questions.",
  [ERROR_CODES.DATABASE_CONNECTION_FAILED]:
    "Database connection failed. Please try again.",
  [ERROR_CODES.TEST_NOT_FOUND]: "Test not found. Please check the test ID.",
  [ERROR_CODES.USER_NOT_FOUND]: "User not found. Please log in again.",
  [ERROR_CODES.INVALID_TEST_DETAILS]: "Invalid test details provided.",
  [ERROR_CODES.INVALID_QUESTIONS]: "Failed to generate valid questions.",
  [ERROR_CODES.INVALID_USER_ANSWERS]: "Invalid user answers provided.",
  [ERROR_CODES.UNAUTHORIZED]: "You are not authorized to perform this action.",
  [ERROR_CODES.INVALID_CREDENTIALS]: "Invalid email or password.",
  [ERROR_CODES.INTERNAL_SERVER_ERROR]: "An internal server error occurred.",
  [ERROR_CODES.SERVICE_UNAVAILABLE]: "Service temporarily unavailable.",
};

export function getErrorMessage(error) {
  if (error instanceof ThinkTrackError) {
    return ERROR_MESSAGES[error.code] || error.message;
  }

  // Handle specific error types
  if (error.message?.includes("overloaded") || error.message?.includes("503")) {
    return ERROR_MESSAGES[ERROR_CODES.GEMINI_API_OVERLOADED];
  }

  if (error.message?.includes("Service Unavailable")) {
    return ERROR_MESSAGES[ERROR_CODES.SERVICE_UNAVAILABLE];
  }

  if (error.message?.includes("Unauthorized")) {
    return ERROR_MESSAGES[ERROR_CODES.UNAUTHORIZED];
  }

  return ERROR_MESSAGES[ERROR_CODES.INTERNAL_SERVER_ERROR];
}

export function isRetryableError(error) {
  const retryableStatuses = [503, 429, 500, 502, 504];
  const retryableMessages = ["overloaded", "timeout", "network", "connection"];

  if (error.status && retryableStatuses.includes(error.status)) {
    return true;
  }

  if (error.message) {
    return retryableMessages.some((msg) =>
      error.message.toLowerCase().includes(msg)
    );
  }

  return false;
}

export function logError(error, context = "") {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    context,
    message: error.message,
    stack: error.stack,
    code: error.code || "UNKNOWN",
    status: error.status || "UNKNOWN",
  };

  console.error(`[${timestamp}] ${context}:`, errorInfo);

  // In production, you might want to send this to an error tracking service
  // like Sentry, LogRocket, or DataDog
}

export function handleApiError(
  error,
  defaultMessage = "An unexpected error occurred"
) {
  logError(error, "API Error");

  const message = getErrorMessage(error);
  const isRetryable = isRetryableError(error);

  return {
    success: false,
    error: message,
    code: error.code || "UNKNOWN_ERROR",
    retryable: isRetryable,
    timestamp: new Date().toISOString(),
  };
}

// Success response helper
export function createSuccessResponse(data, message = "Operation successful") {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}
