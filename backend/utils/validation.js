// Shared validation utilities for better code reusability and maintainability

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates if a string is a valid UUID
 * @param {string} id - The ID to validate
 * @returns {boolean} - True if valid UUID, false otherwise
 */
const isValidUUID = (id) => {
  return typeof id === 'string' && UUID_REGEX.test(id);
};

/**
 * Validates required fields in request body
 * @param {object} body - Request body
 * @param {string[]} requiredFields - Array of required field names
 * @returns {object} - { valid: boolean, missing: string[] }
 */
const validateRequiredFields = (body, requiredFields) => {
  const missing = requiredFields.filter(field => !body[field]);
  return {
    valid: missing.length === 0,
    missing
  };
};

/**
 * Sanitizes pagination parameters
 * @param {object} query - Request query parameters
 * @returns {object} - { page: number, limit: number, offset: number }
 */
const sanitizePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20)); // Max 100 items per page
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
};

module.exports = {
  isValidUUID,
  validateRequiredFields,
  sanitizePagination,
  UUID_REGEX
};


