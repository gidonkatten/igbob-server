/**
 * Convert from DateTime to Unix time
 */
 export function convertDateToUnixTime(dateTime) {
  return parseInt((new Date(dateTime).getTime() / 1000).toFixed(0));
}

/**
 * Get user id from req
 */
 export function getUserId(req) {
   return req !== undefined && req.user !== undefined ? req.user.sub : undefined;
}