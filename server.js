const express = require('express')
const app = express()
const Busboy = require('busboy')
const uuidv1 = require('uuid/v1') // timestamp based
const path = require('path')
const os = require('os')
const fs = require('fs')
const PORT = 8080

app.post('/train', function (req, res) {

    const busboy = new Busboy({ headers: req.headers })
    let fileStream = null
    let filePath = null
    const id = uuidv1()
    const date = Date.now()
    const trainFileName = `${id}.train.txt`
    busboy.on('file', (fieldName, file, fileName, encoding, mimetype) => {
        // TODO upload to AWS S3 id folder
        filePath = path.join(os.tmpdir(), trainFileName)
        fileStream = file.pipe(fs.createWriteStream(filePath))
    });

    busboy.on('finish', () => {
        if(!fileStream){
            res.status(400).send({error: 'Cannot save given training data'})
        } else {
            fileStream.on('finish', () => {
                res.status(200).send({data: { id: id, path: filePath }})
            })
            fileStream.on('error', () => {
                res.status(400).send({error: 'Error occurred while writing file'})
            })
        }
    })

    req.pipe(busboy)
})

app.listen(PORT, () => {
    console.log('\n');
    console.log('+--------------------------')
    console.log(' PID %d', process.pid)
    console.log(' Listening on port', PORT)
    console.log('+--------------------------')
})
