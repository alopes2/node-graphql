const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user');

const keys = require('../config/keys');

exports.signup = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const error = new Error('Validation failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    const email = req.body.email;
    const name = req.body.name;
    const password = req.body.password;

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      email: email,
      name: name,
      password: hashedPassword
    });

    const result = await user.save();

    res.status(201).json({ message: 'User created!', userId: result._id });
  } catch (e) {
    if (!e.statusCode) {
      e.statusCode = 500;
    }

    next(e);
  }
};

exports.login = async (req, res, next) => {
  try {
    const email = req.body.email;
    const password = req.body.password;

    const user = await User.findOne({ email: email });

    if (!user) {
      const error = new Error('User or password incorrect.');
      error.statusCode = 401;
      throw error;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      const error = new Error('User or password incorrect.');
      error.statusCode = 401;
      throw error;
    }

    const token = jwt.sign(
      { email: user.email, userId: user._id.toString() },
      keys.jwtSecret, // This is a string known only to the server
      { expiresIn: '1h' }
    );

    res
      .status(200)
      .json({ message: 'User logged in!', token: token, userId: user._id });
  } catch (e) {
    if (!e.statusCode) {
      e.statusCode = 500;
    }

    next(e);
  }
};

exports.getUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error('User does not exist.');
      error.statusCode = 404;
      throw error;
    }

    res
      .status(200)
      .json({ message: 'User status found!', status: user.status });
  } catch (e) {
    if (!e.statusCode) {
      e.statusCode = 500;
    }

    next(e);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const status = req.body.status;
    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error('User does not exist.');
      error.statusCode = 404;
      throw error;
    }

    user.status = status;

    var result = await user.save();

    res.status(200).json({ message: 'User status udpated!', result: result });
  } catch (e) {
    if (!e.statusCode) {
      e.statusCode = 500;
    }

    next(e);
  }
};
