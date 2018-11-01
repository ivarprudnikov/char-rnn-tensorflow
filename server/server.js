const express = require('express')
const app = express()
const Busboy = require('busboy')
const uuidv1 = require('uuid/v1') // timestamp based
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const {spawn} = require('child_process')
const util = require("util")

const PORT = 8080
const TRAIN_FILENAME = "train.txt"
const TRAIN_PID_FILENAME = "train.pid"
const LOG_FILENAME = "output.log"
const UPLOADS_DIR = "uploads"
const MODEL_DIR = "model"
const PUBLIC_DIR = "public"
const VIEWS_DIR = "views"
const STATUS_IN_PROGRESS = "In progress"
const STATUS_STOPPED = "Stopped"
const GENERATOR_PATH = path.join(__dirname, '../generator')

app.set('views', path.join(__dirname, VIEWS_DIR));
app.set('view engine', 'ejs');
app.use('/static', express.static(path.join(__dirname, PUBLIC_DIR)))
// create directory for uploads if does not exist
const UPLOADS_PATH = path.join(__dirname, UPLOADS_DIR)
mkdirp.sync(UPLOADS_PATH)

// Methods
//////////////////////////////////////////////////////////////////////

function trainModel(submissionId) {

  if (!submissionId) return;

  const folderPath = path.join(UPLOADS_PATH, submissionId)
  const trainFilePath = path.join(folderPath, TRAIN_FILENAME)
  const trainPidPath = path.join(folderPath, TRAIN_PID_FILENAME)
  const modelDir = path.join(GENERATOR_PATH, submissionId, MODEL_DIR)
  rimraf.sync(modelDir)
  mkdirp.sync(modelDir)

  const logFilePath = path.join(folderPath, LOG_FILENAME)
  fs.writeFileSync(logFilePath)
  const out = fs.openSync(logFilePath, 'a');
  const err = fs.openSync(logFilePath, 'a');
  /*
  python train.py \
    --input_file data/shakespeare.txt  \
    --name shakespeare \
    --num_steps 50 \
    --num_seqs 32 \
    --learning_rate 0.01 \
    --max_steps 20000
  */
  const subprocess = spawn('python', [
    path.join(GENERATOR_PATH, 'train.py'),
    "--input_file", trainFilePath,
    "--name", submissionId,
    "--num_steps", "50",
    "--num_seqs", "32",
    "--learning_rate", "0.01",
    "--max_steps", "100"
  ], {
    stdio: ['ignore', out, err]
  });
  fs.writeFileSync(trainPidPath, subprocess.pid)
  subprocess.on("error", () => rimraf.sync(trainPidPath))
  subprocess.on("exit", () => rimraf.sync(trainPidPath))
}

/**
 *
 * @param submissionId
 * @return readable stream
 */
function sampleModel(submissionId) {

  let cbCalled = false
  function callBack(data) {
    if (!cbCalled) {
      cbCalled = true
      cb(data && data.toString())
    }
  }

  if (!submissionId) return callBack("missing id")

  const modelDir = path.join(GENERATOR_PATH, submissionId, MODEL_DIR)
  if (!fs.existsSync(modelDir)) return callBack("missing model")

  /*
  python sample.py \
    --converter_path model/shakespeare/converter.pkl \
    --checkpoint_path model/shakespeare/ \
    --max_length 1000
  */
  const subprocess = spawn('python', [
    path.join(GENERATOR_PATH, 'sample.py'),
    "--converter_path", path.join(modelDir, "converter.pkl"),
    "--checkpoint_path", modelDir,
    "--max_length", "1000"
  ]);

  subprocess.stdout.on('data', (data) => callBack(data));
  subprocess.stderr.on('data', (data) => callBack(data));
  subprocess.on("error", callBack)
  subprocess.on("exit", callBack)
}

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
 */
app.post('/train', function (req, res) {

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

        trainModel(id + "")

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
  program.pipe(res)
  program.on('end', function() {
    res.end({text:"Completed"});
  });
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
