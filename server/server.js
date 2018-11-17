const express = require('express')
const app = express()
const path = require('path')
const mkdirp = require('mkdirp')
const modelRouter = require('./router-model')
const {
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

app.get('/', (req, res) => {
  res.render('index')
})
app.use('/model', modelRouter)

app.listen(PORT, () => {
  console.log('\n');
  console.log('+--------------------------')
  console.log(' PID %d', process.pid)
  console.log(' Listening on port', PORT)
  console.log('+--------------------------')
})
