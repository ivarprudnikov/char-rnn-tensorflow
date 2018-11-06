const express = require('express')
const app = express()
const Busboy = require('busboy')
const uuidv1 = require('uuid/v1') // timestamp based
const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')
const {sampleModel, trainModel, chackTrainParams} = require("./generator");
const multer  = require('multer')
const multerUpload = multer()
const util = require("util")
const {
  TRAIN_FILENAME,
  TRAIN_PID_FILENAME,
  LOG_FILENAME,
  VIEWS_DIR,
  PUBLIC_DIR,
  UPLOADS_PATH,
  PORT,
  STATUS_IN_PROGRESS,
  STATUS_STOPPED
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
  next();
});

// Routes
//////////////////////////////////////////////////////////////////////

app.get('/', function (req, res) {
  res.render('index')
})

app.get('/train', function (req, res) {
  res.render('train')
})

/**
 * Upload save text file and spawn training script
 * Here set multerUpload.none() as it is used only for
 * form field parsing
 * Busboy will handle file uploads
 */
app.post('/train', multerUpload.none(), function (req, res) {

  let params = req.body
  let errors = chackTrainParams(params)
  if (errors) {
    res.render('train', Object.assign(res.locals, {errors: errors}))
    return
  }

  const id = uuidv1()
  const busboy = new Busboy({
    headers: req.headers,
    limits: {
      fileSize: 1024 * 50, // bytes
      files: 1 // only one file per request
    }
  })
  let fileStream = null
  let filePath = null
  let folderPath = path.join(UPLOADS_PATH, id)

  busboy.on('file', (fieldName, file, fileName, encoding, mimetype) => {
    // TODO upload to AWS S3 id folder
    fs.mkdirSync(folderPath)
    filePath = path.join(folderPath, TRAIN_FILENAME)
    fileStream = file.pipe(fs.createWriteStream(filePath))
  });

  busboy.on('finish', () => {
    res.set({Connection: 'close'});

    if (!fileStream) {
      res.locals.error = "Cannot save given training data";
      res.render('train');
    } else {
      fileStream.on('finish', () => {

        trainModel(id + "", params)

        res.locals.id = id
        res.locals.folder = folderPath
        res.locals.file = filePath
        res.render('uploaded');
      })
      fileStream.on('error', () => {
        res.locals.error = "Error occurred while writing file";
        res.render('train');
      })
    }
  })

  req.pipe(busboy)
})

app.get('/models', function (req, res) {
  const folders = fs.readdirSync(UPLOADS_PATH)
  res.locals.models = (folders || []).map((folderName) => {
    return {
      id: folderName,
      status: fs.existsSync(path.join(UPLOADS_PATH, folderName, TRAIN_PID_FILENAME)) ? STATUS_IN_PROGRESS : STATUS_STOPPED
    }
  });
  res.render('models')
})

app.get('/models/:id', function (req, res) {
  const id = req.params.id
  res.locals.id = id
  const logFile = path.join(UPLOADS_PATH, id, LOG_FILENAME)
  const trainPidFile = path.join(UPLOADS_PATH, id, TRAIN_PID_FILENAME)
  if (!fs.existsSync(logFile)) {
    res.render('404')
    return
  }
  res.locals.log = fs.readFileSync(logFile)
  res.locals.status = fs.existsSync(trainPidFile) ? STATUS_IN_PROGRESS : STATUS_STOPPED
  res.render('model')
})

app.get('/models/:id/sample', function (req, res) {
  const id = req.params.id
  if (!id) {
    res.status(400).send({error: "Unrecognized ID"})
    return
  }
  if (fs.existsSync(path.join(UPLOADS_PATH, id, TRAIN_PID_FILENAME))) {
    res.status(400).send({error: "Training still in progress"})
    return
  }

  const program = sampleModel(id)
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
