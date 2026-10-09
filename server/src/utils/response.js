/**
 * Standardized API response helpers.
 */

export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = { success: true, message };
  if (data !== null) response.data = data;
  return res.status(statusCode).json(response);
};

export const sendCreated = (res, data = null, message = 'Created successfully') => {
  return sendSuccess(res, data, message, 201);
};

export const sendPaginated = (res, data, pagination, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination,
  });
};

export const sendError = (res, message = 'Internal server error', statusCode = 500, errorCode = 'INTERNAL_ERROR') => {
  return res.status(statusCode).json({
    success: false,
    message,
    errorCode,
  });
};
