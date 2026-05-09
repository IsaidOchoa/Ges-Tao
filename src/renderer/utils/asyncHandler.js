export const asyncHandler = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    console.error(`[AsyncHandler] Error en ${fn.name}:`, error);
    throw error;
  }
};