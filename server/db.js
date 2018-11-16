const mysql = require('mysql')
var pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'rnn_generator'
});

function list(limit, offset, cb) {
  pool.query("select * from model order by updated_at desc limit ? offset ?",
    [limit, offset],
    (error, results) => {
      if (error) throw error
      cb && cb(results)
    })
}

function insertModel(params, cb) {
  pool.query("INSERT INTO model SET ?", params,
    (error, results) => {
      if (error) throw error
      cb && cb(results)
    })
}

function insertLogEntry(params, cb) {
  pool.query("INSERT INTO model_log SET ?", params,
    (error, results) => {
      if (error) throw error
      cb && cb(results)
    })
}

function deleteLogEntries(id, cb) {
  pool.query("delete from model_log where model_id = ?", id,
    (error, results) => {
      if (error) throw error
      cb && cb(results)
    })
}

function updateModel(id, params, cb) {
  pool.query("UPDATE model SET ? WHERE id=?", [params, id], (error, results) => {
    if (error) throw error
    cb && cb(results)
  })
}

function setModelHasData(id, value, cb) {
  pool.query("UPDATE model SET ? WHERE id=?", [{
    has_data: value ? 1 : 0
  }, id], (error, results) => {
    if (error) throw error
    cb && cb(results)
  })
}

function setModelTrainingStarted(id, pid, cb) {
  pool.query("UPDATE model SET ? WHERE id=?", [{
    training_pid: pid,
    is_in_progress: 1,
    is_complete: 0
  }, id], (error, results) => {
    if (error) throw error
    cb && cb(results)
  })
}

function setModelTrainingStopped(id, cb) {
  pool.query("UPDATE model SET ? WHERE id=?", [{
    training_pid: null,
    is_in_progress: 0,
    is_complete: 1
  }, id], (error, results) => {
    if (error) throw error
    cb && cb(results)
  })
}

function findModel(id, cb) {
  pool.query("select * from model where id = ?",
    [id],
    (error, results) => {
      if (error) throw error
      cb && cb(results && results[0])
    })
}

function findLog(id, cb) {
  pool.query("select * from model_log where model_id = ? order by position asc",
    [id],
    (error, results) => {
      if (error) throw error
      cb && cb(results)
    })
}

module.exports = {
  list,
  insertModel,
  insertLogEntry,
  deleteLogEntries,
  findModel,
  findLog,
  updateModel,
  setModelTrainingStarted,
  setModelTrainingStopped,
  setModelHasData
}
