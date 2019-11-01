const mysql = require('mysql')
var pool = mysql.createPool({
  connectionLimit: 10,
  connectTimeout: 20 * 1000,
  acquireTimeout: 20 * 1000,
  timeout: 10 * 1000,
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'rnn_generator',
  port: process.env.MYSQL_PORT || 3306,
  ssl: process.env.MYSQL_SSL || false,
  insecureAuth: true
});

function queryWithPromise(query, positionalParams) {
  return new Promise(function (resolve, reject) {

    function handleCallback(error, rows) {
      if (error) reject(error)
      else resolve(rows)
    }

    if (positionalParams) {
      pool.query(query, positionalParams, handleCallback)
    } else {
      pool.query(query, handleCallback)
    }
  });
}

module.exports.list = (limit, offset) => {
  return queryWithPromise("select * from model order by updated_at desc limit ? offset ?", [limit, offset])
}

module.exports.count = () => {
  return queryWithPromise("select count(*) as t from model where 1=1")
    .then((rows) => rows && rows[0] && rows[0].t)
}

module.exports.insertModel = (params) => {
  return queryWithPromise("INSERT INTO model SET ?", params)
}

module.exports.insertLogEntry = (params) => {
  return queryWithPromise("INSERT INTO model_log SET ?", params)
}

module.exports.deleteLogEntries = (id) => {
  return queryWithPromise("delete from model_log where model_id = ?", id)
}

module.exports.updateModel = (id, params) => {
  return queryWithPromise("UPDATE model SET ? WHERE id=?", [params, id])
}

module.exports.setModelHasData = (id, value) => {
  return queryWithPromise("UPDATE model SET ? WHERE id=?", [{
    has_data: value ? 1 : 0
  }, id])
}

module.exports.setModelTrainingStarted = (id, pid) => {
  return queryWithPromise("UPDATE model SET ? WHERE id=?", [{
    training_pid: pid,
    is_in_progress: 1,
    is_complete: 0
  }, id])
}

module.exports.setModelTrainingStopped = (id) => {
  return queryWithPromise("UPDATE model SET ? WHERE id=?", [{
    training_pid: null,
    is_in_progress: 0,
    is_complete: 1
  }, id])
}

module.exports.findModel = (id) => {
  return queryWithPromise("select * from model where id = ?", [id])
    .then((rows) => rows && rows[0])
}

module.exports.findLog = (id) => {
  return queryWithPromise("select * from model_log where model_id = ? order by position asc", [id])
}
