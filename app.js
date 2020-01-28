const path = require('path');
const fs = require('fs');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const graphqlHttp = require('express-graphql');
const upload = require('multer');
const helmet = require('helmet');
const compression = require('compression');

const keys = require('./config/keys');
const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const authMiddleware = require('./middleware/auth');
const { clearImage } = require('./util/file');

const app = express();

const fileStorage = upload.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const filefilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'logs/access.log'),
  { flags: 'a' }
);
app.use(helmet());
app.use(compression());

// if you remove the second argument, logs will be written to the console
app.use(morgan('combined', { stream: accessLogStream }));

app.use(bodyParser.json());
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

app.use(authMiddleware);

app.put(
  '/post-image',
  upload({ storage: fileStorage, fileFilter: filefilter }).single('image'),
  (req, res, next) => {
    if (!req.isAuth) {
      throw new Error('Not authenticated.');
    }

    if (!req.file) {
      return res.status(200).json({ message: 'No file provided!' });
    }

    if (req.body.oldPath) {
      clearImage(req.body.oldPath);
    }

    return res
      .status(201)
      .json({ message: 'File stored.', filePath: req.file.path });
  }
);

app.use(
  '/graphql',
  graphqlHttp({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    formatError(err) {
      if (!err.originalError) {
        return err;
      }

      const data = err.originalError.data;
      const message = err.message || 'An error occurred';
      const code = err.originalError.code || 500;

      return { message: message, status: code, data: data };
    }
  })
);

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;

  res.status(status).json({ message: message, data: data });
});

mongoose
  .connect(keys.mongoUri)
  .then(result => {
    app.listen(8080);

    console.log('-----------------------');
    console.log('Listening on port 8080');
    console.log('-----------------------');
  })
  .catch(err => {
    console.log(err);
  });
