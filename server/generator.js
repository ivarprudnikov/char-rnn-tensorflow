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
  MODEL_DIR,
  LOG_FILENAME
} = require("./constants")

const trainOptionsSchema = {
  $id: "generator/schema/training/options.json",
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    num_seqs: {type: "integer", minimum: 1, description: "number of seqs in one batch"},
    num_steps: {type: "integer", minimum: 1, description: "length of one seq"},
    lstm_size: {type: "integer", minimum: 0, description: "size of hidden state of lstm"},
    num_layers: {type: "integer", minimum: 0, description: "number of lstm layers"},
    use_embedding: {type: "boolean", description: "whether to use embedding"},
    embedding_size: {type: "integer", minimum: 1, description: "size of embedding"},
    learning_rate: {type: "number", minimum: 0, maximum: 1, description: "learning rate"},
    train_keep_prob: {type: "number", minimum: 0, maximum: 1, description: "dropout rate during training"},
    max_steps: {type: "integer", minimum: 1, description: "max steps to train"},
    save_every_n: {type: "integer", minimum: 1, description: "save the model every n steps"},
    log_every_n: {type: "integer", minimum: 1, description: "log to the screen every n steps"},
    max_vocab: {type: "integer", minimum: 1, description: "max char number"}
  },
  additionalProperties: false
}

const sampleOptionsSchema = {
  $id: "generator/schema/sampling/options.json",
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    lstm_size: {type: "integer", minimum: 0, description: "size of hidden state of lstm"},
    num_layers: {type: "integer", minimum: 0, description: "number of lstm layers"},
    use_embedding: {type: "boolean", description: "whether to use embedding"},
    embedding_size: {type: "integer", minimum: 1, description: "size of embedding"},
    start_string: {type: "string", description: "use this string to start generating"},
    max_length: {type: "integer", minimum: 1, description: "max length to generate"},
  },
  additionalProperties: false
}

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
 * @return {Object} errors
 */
function trainModel(submissionId, params, cb) {

  if (!submissionId) return cb("submissionId required");

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
  if (typeof params === "object") {
    let errors = chackTrainParams(params)
    if (errors) {
      return cb(errors)
    } else {
      Object.assign(args, params)
    }
  }

  const folderPath = path.join(UPLOADS_PATH, submissionId)
  const trainFilePath = path.join(folderPath, TRAIN_FILENAME)
  if (!fs.existsSync(trainFilePath)) return cb("missing training data file")
  const trainPidPath = path.join(folderPath, TRAIN_PID_FILENAME)
  const modelDir = path.join(GENERATOR_PATH, MODEL_DIR, submissionId)
  rimraf.sync(modelDir)
  mkdirp.sync(modelDir)

  const logFilePath = path.join(folderPath, LOG_FILENAME)
  fs.writeFileSync(logFilePath)
  const logBinding = fs.openSync(logFilePath, 'a');
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
  console.log("Training", util.inspect(spawnArgs))
  const subprocess = spawn('python', spawnArgs, {
    stdio: ['ignore', logBinding, logBinding]
  });
  fs.writeFileSync(trainPidPath, subprocess.pid)
  subprocess.on("error", () => {
    rimraf.sync(trainPidPath)
    setModelTrainingStopped(submissionId, () => {
    })
  })
  subprocess.on("exit", () => {
    rimraf.sync(trainPidPath)
    setModelTrainingStopped(submissionId, () => {
    })
  })

  return cb(null, subprocess);
}

/**
 * @param submissionId {String}
 * @param cb {Function} callback
 */
function sampleModel(submissionId, params, cb) {

  if (!submissionId) return cb("submissionId required");

  const modelDir = path.join(GENERATOR_PATH, MODEL_DIR, submissionId)
  if (!fs.existsSync(modelDir)) return cb("missing the model")

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
      return cb(errors)
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
  const process = spawn('python', spawnArgs, {
    stdio: ["ignore", "pipe", "pipe"]
  });

  cb(null, process)
}

module.exports = {
  trainOptionsSchema,
  chackTrainParams,
  trainModel,
  sampleModel
}
