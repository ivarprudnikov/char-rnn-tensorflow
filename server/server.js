const express = require('express')
const app = express()
const Busboy = require('busboy')
const uuidv1 = require('uuid/v1') // timestamp based
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const {spawn} = require('child_process')

const PORT = 8080
const TRAIN_FILENAME = "train.txt"
const TRAIN_PID_FILENAME = "train.pid"
const UPLOADS_DIR = "uploads"
const MODEL_DIR = "model"
const PUBLIC_DIR = "public"
const VIEWS_DIR = "views"

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

  console.log(UPLOADS_PATH, submissionId)

  let folderPath = path.join(UPLOADS_PATH, submissionId)
  let trainFilePath = path.join(folderPath, TRAIN_FILENAME)
  let trainPidPath = path.join(folderPath, TRAIN_PID_FILENAME)
  const modelDir = path.join(folderPath, MODEL_DIR)
  rimraf.sync(modelDir)
  mkdirp.sync(modelDir)

  const logFilePath = path.join(folderPath, 'output.log')
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
    path.join(__dirname, '../generator/train.py'),
    `--input_file ${trainFilePath}`,
    `--name ${Date.now()}`,
    "--num_steps 50",
    "--num_seqs 32",
    "--learning_rate 0.01",
    "--max_steps 20000",
  ], {
    stdio: ['ignore', out, err]
  });
  fs.writeFileSync(trainPidPath, subprocess.pid)
  subprocess.on("error", () => rimraf.sync(trainPidPath))
  subprocess.on("exit", () => rimraf.sync(trainPidPath))
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
      name: folderName,
      status: 'In progress'
    }
  });
  res.render('models')
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
