const express = require('express')
const app = express()
const Busboy = require('busboy')
const uuidv1 = require('uuid/v1') // timestamp based
const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')
const {sampleModel, trainModel, chackTrainParams} = require("./generator");
const multer = require('multer')
const multerUpload = multer()
const {list, insertModel, findModel, updateModel, setModelHasData, setModelTrainingStarted, setModelTrainingStopped} = require('./db')

const {
  TRAIN_FILENAME,
  LOG_FILENAME,
  VIEWS_DIR,
  PUBLIC_DIR,
  UPLOADS_PATH,
  PORT
} = require("./constants")

app.set('views', path.join(__dirname, VIEWS_DIR));
app.set('view engine', 'ejs');
app.use('/static', express.static(path.join(__dirname, PUBLIC_DIR)))
// create directory for uploads if does not exist
mkdirp.sync(UPLOADS_PATH)

// HTML Form helper
app.use(function (req, res, next) {
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
});

// METHODS
//////////////////////////////////////////////////////////////////////

function checkPathParamSet(paramName) {
  return function (req, res, next) {
    if (!req.params[paramName]) {
      res.render('404')
      return
    }
    next()
  }
}

function loadInstanceById() {
  return function (req, res, next) {
    findModel(req.params.id, (instance) => {
      if (!instance) {
        res.render('404')
      } else {
        req.instance = instance;
        next()
      }
    })
  }
}

// Routes
//////////////////////////////////////////////////////////////////////

app.get('/', function (req, res) {
  res.render('index')
})

app.get('/model', function (req, res) {
  let limit = Math.min(parseInt(req.query.max) || 10, 100)
  let offset = parseInt(req.query.offset) || 0

  list(limit, offset, (results) => res.render('list', Object.assign(res.locals, {models: results})))
})

app.get('/model/create', function (req, res) {
  res.render('create')
})

app.post('/model/create', multerUpload.none(), function (req, res) {

  let name = req.body.name

  if (!name) {
    res.render('create', Object.assign(res.locals, {
      error: "Found 1 error",
      errors: {
        name: "Name is required"
      }
    }))
    return
  }

  res.set({Connection: 'close'});
  const id = uuidv1()

  insertModel( {
    id: id,
    name: name,
    train_params: "{}"
  }, () => res.redirect("/model/" + id))
})

app.get('/model/:id', checkPathParamSet("id"), loadInstanceById(), function (req, res) {
  const model = req.instance
  const logFile = path.join(UPLOADS_PATH, model.id, LOG_FILENAME)
  if (fs.existsSync(logFile)) {
    res.locals.log = fs.readFileSync(logFile)
  }
  res.render('show', Object.assign(res.locals, {model: req.instance}))
})

app.get('/model/:id/options', checkPathParamSet("id"), loadInstanceById(), function (req, res) {
  res.render('training_options', Object.assign(res.locals, {
    data: JSON.parse(req.instance.train_params),
    model: req.instance
  }))
})

app.post('/model/:id/options', checkPathParamSet("id"), loadInstanceById(), multerUpload.none(), function (req, res) {

  let model = req.instance

  // filter out empty values
  let params = Object.keys(req.body).reduce((memo, val) => {
    if (req.body[val] != null && req.body[val] !== "") {
      memo[val] = req.body[val]
    }
    return memo
  }, {})

  let errors = chackTrainParams(params)
  if (errors) {
    res.render('training_options', Object.assign(res.locals, {
      error: "Found " + Object.keys(errors).length + " errors",
      errors: errors,
      data: params,
      model: req.instance
    }))
    return
  }

  updateModel(model.id, {train_params: JSON.stringify(params)}, () => res.redirect("/model/" + model.id))
})

app.get('/model/:id/upload', checkPathParamSet("id"), loadInstanceById(), function (req, res) {
  res.render('upload', Object.assign(res.locals, {model: req.instance}))
})

/**
 * Upload save text file and spawn training script
 */
app.post('/model/:id/upload', checkPathParamSet("id"), loadInstanceById(), function (req, res) {

  let model = req.instance

  const busboy = new Busboy({
    headers: req.headers,
    limits: {
      fileSize: 1024 * 50, // bytes
      files: 1 // only one file per request
    }
  })
  let fileStream = null
  let filePath = null
  let folderPath = path.join(UPLOADS_PATH, model.id)

  busboy.on('file', (fieldName, file, fileName) => {
    if (fileName) {
      fs.mkdirSync(folderPath)
      filePath = path.join(folderPath, TRAIN_FILENAME)
      fileStream = file.pipe(fs.createWriteStream(filePath))
    }
  });

  busboy.on('finish', () => {
    res.set({Connection: 'close'});

    if (!fileStream) {
      res.render('upload', Object.assign(res.locals, {
        error: "Cannot save given training data",
        errors: {
          "file": "Cannot save given training data"
        },
        model: model
      }));
    } else {
      fileStream.on('finish', () => {
        setModelHasData(model.id, true, () => res.redirect("/model/" + model.id))
      })
      fileStream.on('error', () => {
        res.render('upload', Object.assign(res.locals, {
          error: "Error occurred while saving file",
          errors: {
            "file": "Error occurred while saving file"
          },
          model: model
        }));
      })
    }
  })

  req.pipe(busboy)
})

app.post('/model/:id/start', checkPathParamSet("id"), loadInstanceById(), function (req, res) {

  let model = req.instance
  if (model.training_pid) {
    return res.redirect("/model/" + model.id)
  }

  const params = JSON.parse(model.train_params || "{}")
  trainModel(model.id, params, (err, process) => {
    if (err) {
      console.log(err)
      setModelTrainingStopped(model.id, () => res.redirect("/model/" + model.id))
    } else {
      setModelTrainingStarted(model.id, process.pid, () => res.redirect("/model/" + model.id))
    }
  })
})

app.post('/model/:id/stop', checkPathParamSet("id"), loadInstanceById(), function (req, res) {

  let model = req.instance
  if (model.training_pid) {
    process.kill(model.training_pid)
  }

  setModelTrainingStopped(model.id, () => res.redirect("/model/" + model.id))
})

app.get('/model/:id/sample', checkPathParamSet("id"), loadInstanceById(), function (req, res) {
  let model = req.instance
  if (!model.is_complete) {
    res.status(400).send({error: "Not ready yet"})
    return
  }

  const program = sampleModel(model.id)
  res.set('Content-Type', 'text/plain');
  program.stdout.pipe(res)
  program.stderr.pipe(res)
})

// Start server
//////////////////////////////////////////////////////////////////////

app.listen(PORT, () => {
  console.log('\n');
  console.log('+--------------------------')
  console.log(' PID %d', process.pid)
  console.log(' Listening on port', PORT)
  console.log('+--------------------------')
})
