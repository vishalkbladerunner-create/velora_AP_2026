// Application-level middleware: print one line per request.
const logger = (req, res, next) => {
  console.log(req.method + ' ' + req.url);
  next();
};

module.exports = logger;
