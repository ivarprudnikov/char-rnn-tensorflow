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
const mysql = require('mysql')
var pool = mysql.createPool({
  connectionLimit: 10,
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'rnn_generator'
});
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
  res.locals.fieldData = (key) => {
    const resLocals = res.locals || {}
    const data = resLocals.data || {}
    return data[key];
  }
  next();
});

// Routes
//////////////////////////////////////////////////////////////////////

app.get('/', function (req, res) {
  res.render('index')
})

app.get('/model', function (req, res) {
  let limit = Math.min(parseInt(req.query.max) || 10, 100)
  let offset = parseInt(req.query.offset) || 0
  pool.query("select * from model order by updated_at desc limit ? offset ?",
    [limit, offset],
    (error, results, fields) => {
      if (error) throw error
      res.render('models', {models: results})
    })
})

app.get('/model/create', function (req, res) {
  res.render('create')
})

app.post('/model/create', multerUpload.none(), function (req, res) {

  // filter out empty values
  let params = Object.keys(req.body).reduce((memo, val) => {
    if (req.body[val] != null && req.body[val] !== "") {
      memo[val] = req.body[val]
    }
    return memo
  }, {})

  let errors = chackTrainParams(params)
  if (errors) {
    res.render('create', Object.assign(res.locals, {
      error: "Found " + Object.keys(errors).length + " errors",
      errors: errors,
      data: params
    }))
    return
  }

  res.set({Connection: 'close'});
  const id = uuidv1()

  pool.query("INSERT INTO model SET ?", {
      id: id,
      train_params: JSON.stringify(params),
      has_data: 0,
      is_in_progress: 0
    },
    (error, results, fields) => {
      if (error) throw error
      res.redirect("/model/" + id)
    })
})

app.get('/model/:id', function (req, res) {
  const id = req.params.id
  if (!id) {
    res.render('404')
    return
  }

  pool.query("select * from model where id = ?",
    [id],
    (error, results, fields) => {
      if (error) throw error
      if (!results.length) {
        res.render('404')
        return
      }
      res.render('modelInstance', {model: results[0]})
    })
})

app.get('/model/:id/upload', function (req, res) {
  res.render('upload', {id: req.params.id})
})

/**
 * Upload save text file and spawn training script
 */
app.post('/model/:id/upload', function (req, res) {

  const id = req.params.id
  pool.query("select * from model where id = ?",
    [id],
    (error, results, fields) => {
      if (error) throw error
      if (!results.length) {
        res.render('404')
        return
      }

      _upload(results[0])

    })

  function _upload(model) {

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

    busboy.on('file', (fieldName, file, fileName, encoding, mimetype) => {
      fs.mkdirSync(folderPath)
      filePath = path.join(folderPath, TRAIN_FILENAME)
      fileStream = file.pipe(fs.createWriteStream(filePath))
    });

    busboy.on('finish', () => {
      res.set({Connection: 'close'});

      if (!fileStream) {
        res.render('upload', Object.assign(res.locals, {
          error: "Cannot save given training data",
          errors: {
            "file": "Cannot save given training data"
          }
        }));
      } else {
        fileStream.on('finish', () => {
          const params = JSON.parse(model.train_params || "{}")
          trainModel(model.id, params)
          _setInProgress(model, () => res.redirect("/model/" + model.id))
        })
        fileStream.on('error', () => {
          res.render('upload', Object.assign(res.locals, {
            error: "Error occurred while saving file",
            errors: {
              "file": "Error occurred while saving file"
            }
          }));
        })
      }
    })

    req.pipe(busboy)
  }

  function _setInProgress(model, cb) {
    pool.query("UPDATE model SET ? WHERE id=?", [{
        has_data: 1,
        is_in_progress: 1,
        is_complete: 0,
      }, model.id],
      (error, results, fields) => cb())
  }

})

app.get('/model/:id/sample', function (req, res) {
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
