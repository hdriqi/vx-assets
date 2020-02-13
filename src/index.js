require('dotenv').config()

const express = require('express')
const multer = require('multer')
const shortid = require('shortid')
const AWS = require('aws-sdk')
const fs = require('fs')

const Worker = require('./worker')
const worker = new Worker()
worker.init()

const app = express()

// configuring the DiscStorage engine.
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename(req, file, cb) {
    const uid = shortid.generate()
    const ts = new Date().getTime()
    cb(null, `${uid}_${ts}_${file.originalname}`)
  }
})
const upload = multer({ storage: storage })

//setting the credentials
//The region should be the region of the bucket that you created
//Visit this if you have any confusion - https://docs.aws.amazon.com/general/latest/gr/rande.html
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS,
  secretAccessKey: process.env.AWS_SECRET,
  region: 'ap-southeast-1',
})

//Creating a new instance of S3:
const s3 = new AWS.S3()

const authVerifyTokenMiddleware = async (req, res, next) => {
  const payload = {
    accessToken: req.headers['authorization']
  }

  const response = await worker.authVerifyToken(payload)

  if(response.status === 'success') {
    return next()
  }

  return res.json(response)
}

const authVerifyClientMiddleware = async (req, res, next) => {
  const payload = {
    clientId: req.headers['x-client-id'],
    clientSecret: req.headers['x-client-secret']
  }

  const response = await worker.authVerifyClient(payload)

  if(response.status === 'success') {
    return next()
  }

  return res.json(response)
}

//POST method route for uploading file
app.post('/upload', authVerifyClientMiddleware, authVerifyTokenMiddleware, upload.single('file'), function(req, res) {
  uploadFile(req.file.path, req.file.filename, req.file.mimetype, res)
})

//GET method route for downloading/retrieving file
app.get('/:file_name', (req, res) => {
  retrieveFile(req.params.file_name, res)
})

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`)
})

//The uploadFile function
async function uploadFile(source, targetName, mime, res) {
  console.log('preparing to upload...')
  try {
    const filedata = fs.readFileSync(source)
    const putParams = {
      Bucket: 'vestrade-static',
      Key: targetName,
      Body: filedata,
      ContentType: mime
    }

    s3.putObject(putParams, (err, data) => {
      if (err) {
        console.log(err)
        return res.json({
          status: 'error'
        })
      }
      fs.unlinkSync(source)
      console.log('Successfully uploaded the file')
      return res.json({
        status: 'success',
        data: {
          filename: targetName,
          url: `${process.env.BASE_URL}/${targetName}`
        }
      })
    })
  } catch (err) {
    console.log({ 'err': err })
    return res.json({
      status: 'error'
    })
  }
}

//The retrieveFile function
function retrieveFile(filename, res) {

  const getParams = {
    Bucket: 'vestrade-static',
    Key: filename
  }

  s3.getObject(getParams, function(err, data) {
    if (err) {
      return res.status(400).send({ success: false, err: err })
    } else {
      if (data.ContentType) {
        res.type(data.ContentType)
      }
      return res.send(data.Body)
    }
  })
}