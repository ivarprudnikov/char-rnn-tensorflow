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
