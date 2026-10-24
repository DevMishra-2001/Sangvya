// Wraps an async route handler so any thrown error / rejected promise
// is forwarded to next(err) automatically, instead of every controller
// needing its own try/catch. Used as: router.get("/", asyncHandler(fn))
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
