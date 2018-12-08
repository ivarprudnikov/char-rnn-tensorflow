const util = require("util")

module.exports.localsFormHelper = (req, res, next) => {
  res.locals.fieldErr = (key) => {
    const resLocals = res.locals || {}
    const errors = resLocals.errors || {}
    return errors[key];
  }
  res.locals.fieldData = (key) => {
    const resLocals = res.locals || {}
    const data = resLocals.data || {}
    return data[key];
  }
  next();
}

module.exports.checkPathParamSet = (paramName) => {
  return (req, res, next) => {
    if (!req.params[paramName]) {
      res.render('404')
      return
    }
    next()
  }
}

const HTTP_SERVER_ERROR = 500
module.exports.errorHandler = () => {
  return (err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }
    console.log((new Date()).toISOString(), "[ERROR]", util.inspect(err))
    return res.status(err.status || HTTP_SERVER_ERROR).render('500');
  }
}

module.exports.asyncErrHandler = (asyncFn, req, res) => asyncFn(req, res)
  .catch(err => {
    console.log((new Date()).toISOString(), "[ERROR]", util.inspect(err))
    res.status(HTTP_SERVER_ERROR).render('500')
  });
