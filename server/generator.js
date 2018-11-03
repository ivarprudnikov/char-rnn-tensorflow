const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const {spawn} = require('child_process')
const {Readable} = require("stream")
const fs = require('fs')
const path = require('path')
const {
  UPLOADS_PATH,
  TRAIN_FILENAME,
  TRAIN_PID_FILENAME,
  GENERATOR_PATH,
  MODEL_DIR,
  LOG_FILENAME
} = require("./constants")

/**
 * Prepare model dir, create log file and try to train on _maybe_ existing train file
 * @param submissionId {String}
 * @return {void}
 */
function trainModel(submissionId) {

  if (!submissionId) return;

  const folderPath = path.join(UPLOADS_PATH, submissionId)
  const trainFilePath = path.join(folderPath, TRAIN_FILENAME)
  const trainPidPath = path.join(folderPath, TRAIN_PID_FILENAME)
  const modelDir = path.join(GENERATOR_PATH, MODEL_DIR, submissionId)
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
 * @param submissionId {String}
 * @return process {ChildProcess}
 */
function sampleModel(submissionId) {

  const s = new Readable()
  const programStub = {
    stdout: s,
    stderr: s
  }

  if (!submissionId) {
    programStub.stderr.push('missing id')
    programStub.stderr.push(null)
    return programStub
  }

  const modelDir = path.join(GENERATOR_PATH, MODEL_DIR, submissionId)
  if (!fs.existsSync(modelDir)) {
    programStub.stderr.push('missing model')
    programStub.stderr.push(null)
    return programStub
  }

  /*
  python sample.py \
    --converter_path model/shakespeare/converter.pkl \
    --checkpoint_path model/shakespeare/ \
    --max_length 1000
  */
  return spawn('python', [
    path.join(GENERATOR_PATH, 'sample.py'),
    "--converter_path", path.join(modelDir, "converter.pkl"),
    "--checkpoint_path", modelDir,
    "--max_length", "1000"
  ], {
    stdio: ["ignore", "pipe", "pipe"]
  });
}

module.exports = {
  trainModel,
  sampleModel
}
