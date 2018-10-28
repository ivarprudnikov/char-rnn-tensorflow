const express = require('express')
const app = express()
const Busboy = require('busboy')
const uuidv1 = require('uuid/v1') // timestamp based
const path = require('path')
const os = require('os')
const fs = require('fs')
const PORT = 8080

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use('/static', express.static(path.join(__dirname, 'public')))

app.get('/', function (req, res) {
  res.render('index')
})

app.get('/train', function (req, res) {
  res.render('train')
})

app.post('/train', function (req, res) {

  const id = uuidv1()
  const busboy = new Busboy({headers: req.headers})
  let fileStream = null
  let filePath = null
  let folderPath = path.join(os.tmpdir(), id)

  busboy.on('file', (fieldName, file, fileName, encoding, mimetype) => {
    // TODO upload to AWS S3 id folder
    fs.mkdirSync(folderPath)
    filePath = path.join(folderPath, 'train.txt')
    fileStream = file.pipe(fs.createWriteStream(filePath))
  });

  busboy.on('finish', () => {
    res.set({Connection: 'close'});

    if (!fileStream) {
      res.locals.error = "Cannot save given training data";
      res.render('train');
    } else {
      fileStream.on('finish', () => {
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
  res.render('models')
})

app.listen(PORT, () => {
  console.log('\n');
  console.log('+--------------------------')
  console.log(' PID %d', process.pid)
  console.log(' Listening on port', PORT)
  console.log('+--------------------------')
})
