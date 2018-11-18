const express = require('express')
const routerModel = express.Router()
const Busboy = require('busboy')
const uuidv1 = require('uuid/v1') // timestamp based
const fs = require('fs')
const {sampleModel, trainModel, chackTrainParams} = require("./generator")
const multer = require('multer')
const multerUpload = multer()
const util = require("util")
const db = require('./db')
const path = require('path')
const {
  WEBSOCKET,
  TRAIN_FILENAME,
  UPLOADS_PATH,
} = require("./constants")
const {checkPathParamSet, localsFormHelper} = require('./middleware')

function loadInstanceById() {
  return (req, res, next) => {
    db.findModel(req.params.id, (instance) => {
      if (!instance) {
        res.render('404')
      } else {
        req.instance = instance;
        next()
      }
    })
  }
}

routerModel.use(localsFormHelper)

routerModel.get('/', async (req, res) => {
  let params = {
    max: Math.min(parseInt(req.query.max) || 10, 100),
    offset: parseInt(req.query.offset) || 0
  }
  let total = await db.count()
  let models = await db.list(params.max, params.offset)

  res.render('list', Object.assign(res.locals, {models, total, params}))
})

routerModel.get('/create', (req, res) => {
  res.render('create')
})

routerModel.post('/create', multerUpload.none(), (req, res) => {

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

  db.insertModel({
    id: id,
    name: name,
    train_params: "{}"
  }, () => res.redirect(`${req.baseUrl}/${id}`))
})

routerModel.get('/:id', checkPathParamSet("id"), loadInstanceById(), (req, res) => {
  db.findLog(req.instance.id, (rows) => {
    let log = (rows || []).map((row) => row.chunk).join("\n")
    res.render('show', Object.assign(res.locals, {
      model: req.instance,
      log: log
    }))
  })
})

routerModel.get('/:id/options', checkPathParamSet("id"), loadInstanceById(), (req, res) => {
  res.render('training_options', Object.assign(res.locals, {
    data: JSON.parse(req.instance.train_params),
    model: req.instance
  }))
})

routerModel.post('/:id/options', checkPathParamSet("id"), loadInstanceById(), multerUpload.none(), (req, res) => {

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

  db.updateModel(model.id, {train_params: JSON.stringify(params)}, () => res.redirect(`${req.baseUrl}/${model.id}`))
})

routerModel.get('/:id/upload', checkPathParamSet("id"), loadInstanceById(), (req, res) => {
  res.render('upload', Object.assign(res.locals, {model: req.instance}))
})

/**
 * Upload save text file and spawn training script
 */
routerModel.post('/:id/upload', checkPathParamSet("id"), loadInstanceById(), (req, res) => {

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
        db.setModelHasData(model.id, true, () => res.redirect(`${req.baseUrl}/${model.id}`))
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

routerModel.post('/:id/start', checkPathParamSet("id"), loadInstanceById(), (req, res) => {

  let model = req.instance
  if (model.training_pid) {
    return res.redirect(`${req.baseUrl}/${model.id}`)
  }

  const params = JSON.parse(model.train_params || "{}")

  db.deleteLogEntries(model.id)

  trainModel(model.id, params, (err, subprocess) => {
    if (err) return db.setModelTrainingStopped(model.id, () =>
      res.render('show', Object.assign(res.locals, {
        model: req.instance,
        error: util.inspect(err)
      }))
    );

    const wss = req.app.get(WEBSOCKET)

    let chunkPosition = 1
    subprocess.stdout.on('data', (data) => {
      let logEntry = {
        model_id: model.id,
        chunk: data + "",
        position: chunkPosition
      }
      db.insertLogEntry(logEntry)
      wss.broadcast(JSON.stringify(logEntry))
      chunkPosition++
    });
    subprocess.stderr.on('data', (data) => {
      let logEntry = {
        model_id: model.id,
        chunk: `Error: ${data}`,
        position: chunkPosition
      }
      db.insertLogEntry(logEntry)
      wss.broadcast(JSON.stringify(logEntry))
      chunkPosition++
    });

    db.setModelTrainingStarted(model.id, subprocess.pid, () =>
      res.redirect(`${req.baseUrl}/${model.id}`)
    );
  })
})

routerModel.post('/:id/stop', checkPathParamSet("id"), loadInstanceById(), (req, res) => {

  let model = req.instance
  if (model.training_pid) {
    try {
      let pid = parseInt(model.training_pid, 10)
      if (!isNaN(pid)) process.kill(pid)
    } catch (e) {
      console.log("Error", util.inspect(e))
    }
  }

  db.setModelTrainingStopped(model.id, () => res.redirect(`${req.baseUrl}/${model.id}`))
})

routerModel.get('/:id/sample', checkPathParamSet("id"), loadInstanceById(), (req, res) => {
  let model = req.instance
  if (!model.is_complete) {
    res.status(400).send({error: "Not ready yet"})
    return
  }

  // use same params from training
  const trainingParams = JSON.parse(model.train_params)
  let args = [
    'lstm_size',
    'num_layers',
    'use_embedding',
    'embedding_size'
  ].reduce((memo, key) => {
    if (trainingParams[key] != null)
      memo[key] = trainingParams[key]
    return memo;
  }, {})

  // TODO add start_string and max_length from query params
  sampleModel(model.id, args, (err, process) => {
    if (err) {
      return res.status(400).send({error: util.inspect(err)})
    }
    res.set('Content-Type', 'text/plain');
    process.stdout.pipe(res)
    process.stderr.pipe(res)
  })
})

module.exports = routerModel
