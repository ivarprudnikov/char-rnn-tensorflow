const express = require('express')
const app = express()
const WebSocket = require("ws")
const http = require("http")
const server = http.createServer(app);
const wss = new WebSocket.Server({server});
const path = require('path')
const mkdirp = require('mkdirp')
const modelRouter = require('./router-model')
const {
  WEBSOCKET,
  VIEWS_DIR,
  PUBLIC_DIR,
  UPLOADS_PATH,
  PORT
} = require("./constants")
const {errorHandler} = require('./middleware')

app.set('views', path.join(__dirname, VIEWS_DIR));
app.set('view engine', 'ejs');
app.use('/static', express.static(path.join(__dirname, PUBLIC_DIR)))
// create directory for uploads if does not exist
mkdirp.sync(UPLOADS_PATH)

app.get('/', (req, res) => {
  res.render('index')
})
app.use('/model', modelRouter)

// Init WebSocket communication
wss.broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    ws.send(`You sent -> ${message}`);
  });
  ws.send('Connection with WebSocket server initialized');
});
app.set(WEBSOCKET, wss);

app.use(errorHandler());

// Start HTTP server
server.listen(PORT, () => {
  console.log('\n');
  console.log('+--------------------------')
  console.log(' PID %d', process.pid)
  console.log(' Listening on port', PORT)
  console.log('+--------------------------')
})
