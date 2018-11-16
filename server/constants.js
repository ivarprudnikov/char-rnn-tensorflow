const path = require('path')

const constants = {
  PORT: 8080,
  TRAIN_FILENAME: "train.txt",
  TRAIN_PID_FILENAME: "train.pid",
  UPLOADS_DIR: "uploads",
  PUBLIC_DIR: "public",
  VIEWS_DIR: "views",
  STATUS_IN_PROGRESS: "In progress",
  STATUS_STOPPED: "Stopped",
  MODEL_DIR: "model",
  GENERATOR_PATH: path.join(__dirname, '../generator')
}
constants.UPLOADS_PATH = path.join(__dirname, constants.UPLOADS_DIR)

module.exports = constants
