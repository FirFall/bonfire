// Express 4 does not catch rejected promises from async route handlers, and an
// unhandled rejection terminates the Node process (Node >= 15). Wrapping every
// async handler sends failures to the error middleware instead, so a Supabase
// problem returns 500 instead of killing the whole server.
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
