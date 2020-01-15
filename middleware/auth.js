const jwt = require('jsonwebtoken');
const keys = require('../config/keys');

exports.isAuth = (req, res, next) => {
  const authHeader = req.get('Authorization');

  if (!authHeader) {
    const error = new Error('Not a valid authorization header.');
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.split(' ')[1];
  let decodedToken;

  try {
    decodedToken = jwt.verify(token, keys.jwtSecret);
  } catch(e) {
    e.statusCode = 500;
    throw e;
  }

  if (!decodedToken) {
    const error = new Error('Not authenticated.');
    error.statusCode = 401;
    throw error;
  }

  req.userId = decodedToken.userId;
  
  next();
};