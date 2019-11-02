const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const {spawn} = require('child_process')
const fs = require('fs')
const path = require('path')
const Ajv = require('ajv');
const {setModelTrainingStopped} = require("./db");
const util = require("util")
const {
  UPLOADS_PATH,
  TRAIN_FILENAME,
  TRAIN_PID_FILENAME,
  GENERATOR_PATH,
  MODEL_DIR
} = require("./constants")

const trainOptionsSchema = require("../generator/train_arguments_schema")
const sampleOptionsSchema = require("../generator/sample_arguments_schema")
const ajv = new Ajv({allErrors: true, coerceTypes: true, removeAdditional: true});
const trainValidator = ajv.compile(trainOptionsSchema)
const sampleValidator = ajv.compile(sampleOptionsSchema)

function validate(validator, params) {
  if (validator(params)) {
    return null
  }
  let errors = {}
  validator.errors.forEach((err) => {
    let keyWithoutTrailingDot = err.dataPath.replace(/^\./, "");
    errors[keyWithoutTrailingDot] = err.message
  })
  return errors
}

function chackTrainParams(params) {
  return validate(trainValidator, params)
}

function checkSampleParams(params) {
  return validate(sampleValidator, params)
}

/**
 * Prepare model dir, create log file and try to train on _maybe_ existing train file
 * @param submissionId {String}
 * @param [params] {Object}
 * @return {Promise}
 */
function trainModel(submissionId, params) {

  let args = {
    num_seqs: 32,
    num_steps: 50,
    lstm_size: 128,
    num_layers: 2,
    use_embedding: false,
    embedding_size: 128,
    learning_rate: 0.001,
    train_keep_prob: 0.5,
    max_steps: 1000,
    save_every_n: 1000,
    log_every_n: 100,
    max_vocab: 3500
  }

  return new Promise(function (resolve, reject) {
    if (!submissionId) reject("submissionId required");

    if (typeof params === "object") {
      let errors = chackTrainParams(params)
      if (errors) {
        return reject(errors)
      } else {
        Object.assign(args, params)
      }
    }

    const folderPath = path.join(UPLOADS_PATH, submissionId)
    const trainFilePath = path.join(folderPath, TRAIN_FILENAME)
    if (!fs.existsSync(trainFilePath))
      return reject("missing training data file")

    const trainPidPath = path.join(folderPath, TRAIN_PID_FILENAME)
    const modelDir = path.join(GENERATOR_PATH, MODEL_DIR, submissionId)
    rimraf.sync(modelDir)
    mkdirp.sync(modelDir)

    /*
    python train.py \
      --input_file data/shakespeare.txt  \
      --name shakespeare \
      --num_steps 50 \
      --num_seqs 32 \
      --learning_rate 0.01 \
      --max_steps 20000
    */
    let spawnArgs = [
      "-u",
      path.join(GENERATOR_PATH, 'train.py'),
      "--input_file", trainFilePath, // utf8 encoded text file
      "--name", submissionId // name of the model
      // TODO add whitelist file
    ]
    Object.keys(args).forEach((k) => {
      if (k != null && args[k] != null) {
        spawnArgs.push(`--${k}`)
        spawnArgs.push(args[k])
      }
    })
    const subprocess = spawn('python', spawnArgs, {
      stdio: ['ignore', "pipe", "pipe"]
    });
    fs.writeFileSync(trainPidPath, subprocess.pid)
    subprocess.on("error", () => {
      rimraf.sync(trainPidPath)
      setModelTrainingStopped(submissionId)
    })
    subprocess.on("exit", () => {
      rimraf.sync(trainPidPath)
      setModelTrainingStopped(submissionId)
    })

    resolve(subprocess);
  })

}

/**
 * @param submissionId {String}
 * @param params {Object}
 * @return {Promise}
 */
function sampleModel(submissionId, params) {

  return new Promise(function (resolve, reject) {

    if (!submissionId) return reject("submissionId required");

    const modelDir = path.join(GENERATOR_PATH, MODEL_DIR, submissionId)
    if (!fs.existsSync(modelDir)) return reject("missing the model")

    let args = {
      lstm_size: 128,
      num_layers: 2,
      use_embedding: false,
      embedding_size: 128,
      start_string: '',
      max_length: 30
    }

    if (typeof params === "object") {
      let errors = checkSampleParams(params)
      if (errors) {
        return reject(errors)
      } else {
        Object.assign(args, params)
      }
    }

    /*
    python sample.py \
      --converter_path model/shakespeare/converter.pkl \
      --checkpoint_path model/shakespeare/ \
      --max_length 1000
    */
    let spawnArgs = [
      "-u",
      path.join(GENERATOR_PATH, 'sample.py'),
      "-W", "ignore",
      "--converter_path", path.join(modelDir, "converter.pkl"),
      "--checkpoint_path", modelDir,
    ]
    Object.keys(args).forEach((k) => {
      if (k != null && args[k] != null) {
        spawnArgs.push(`--${k}`)
        spawnArgs.push(args[k])
      }
    })
    console.log("Sampling", util.inspect(spawnArgs))
    const subprocess = spawn('python', spawnArgs, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    resolve(subprocess)
  })
}

module.exports = {
  chackTrainParams,
  checkSampleParams,
  trainModel,
  sampleModel
}
