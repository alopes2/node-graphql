const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const keys = require('../config/keys');
const { clearImage } = require('../util/file');

const User = require('../models/user');
const Post = require('../models/post');

module.exports = {
  // createUser(args, req) {
  createUser: async function({ userInput }, req) {
    const { email, name, password } = userInput;
    const errors = [];

    if (!validator.isEmail(email)) {
      errors.push({ message: 'Email is invalid.' });
    }

    if (
      validator.isEmpty(password) ||
      !validator.isLength(password, { min: 5 })
    ) {
      errors.push({ message: 'Pasword too short.' });
    }

    if (errors.length > 0) {
      const error = new Error('Invalid input.');
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      const error = new Error('User exists already!');
      throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      email: email,
      name: name,
      password: hashedPassword
    });

    const createdUser = await user.save();

    return {
      ...createdUser._doc,
      _id: createdUser._id.toString()
    };
  },
  login: async function({ email, password }) {
    const user = await User.findOne({ email: email });

    if (!user) {
      const error = new Error('User not found.');
      error.code = 401;
      throw error;
    }

    const passwordIsCorrect = await bcrypt.compare(password, user.password);

    if (!passwordIsCorrect) {
      const error = new Error('Password is incorrect.');
      error.code = 401;
      throw error;
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email
      },
      keys.jwtSecret,
      { expiresIn: '1h' }
    );

    return { token: token, userId: user._id.toString() };
  },
  createPost: async function({ postInput }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated.');
      error.code = 401;
      throw error;
    }

    const { title, content, imageUrl } = postInput;

    const errors = [];
    if (validator.isEmpty(title) || !validator.isLength(title, { min: 5 })) {
      errors.push({
        message: 'Title is required and of length of at least 5.'
      });
    }

    if (
      validator.isEmpty(content) ||
      !validator.isLength(content, { min: 5 })
    ) {
      errors.push({
        message: 'Content is required and of length of at least 5.'
      });
    }

    if (errors.length > 0) {
      const error = new Error('Invalid input.');
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error('Invalid user.');
      error.code = 403;
      throw error;
    }

    const post = new Post({
      title: title,
      content: content,
      imageUrl: imageUrl,
      creator: user
    });

    const newPost = await post.save();

    user.posts.push(newPost);

    await user.save();

    return {
      ...newPost._doc,
      _id: newPost._id.toString(),
      createdAt: newPost.createdAt.toISOString(),
      updatedAt: newPost.updatedAt.toISOString()
    };
  },
  posts: async function({ page }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated.');
      error.code = 401;
      throw error;
    }

    if (!page) {
      page = 1;
    }
    const pageSize = 2;

    const totalPosts = await Post.find().countDocuments();

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(pageSize * (page - 1))
      .limit(pageSize)
      .populate('creator');

    return {
      posts: posts.map(p => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString()
        };
      }),
      totalPosts: totalPosts
    };
  },
  post: async function({ id }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated.');
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(id).populate('creator');

    if (!post) {
      const error = new Error('No post found.');
      error.code = 404;
      throw error;
    }

    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString()
    };
  },
  updatePost: async function({ id, postInput }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated.');
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(id).populate('creator');

    if (!post) {
      const error = new Error('No post found.');
      error.code = 404;
      throw error;
    }

    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error('Not authorized.');
      error.code = 403;
      throw error;
    }

    const { title, content, imageUrl } = postInput;

    const errors = [];
    if (validator.isEmpty(title) || !validator.isLength(title, { min: 5 })) {
      errors.push({
        message: 'Title is required and of length of at least 5.'
      });
    }

    if (
      validator.isEmpty(content) ||
      !validator.isLength(content, { min: 5 })
    ) {
      errors.push({
        message: 'Content is required and of length of at least 5.'
      });
    }

    if (errors.length > 0) {
      const error = new Error('Invalid input.');
      error.data = errors;
      error.code = 422;
      throw error;
    }

    post.title = title;
    post.content = content;

    if (imageUrl !== 'undefined') {
      post.imageUrl = imageUrl;
    }

    const updatePost = await post.save();

    return {
      ...updatePost._doc,
      _id: updatePost._id.toString(),
      createdAt: updatePost.createdAt.toISOString(),
      updatedAt: updatePost.updatedAt.toISOString()
    };
  },
  deletePost: async function({ id }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated.');
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(id);

    if (!post) {
      const error = new Error('No post found.');
      error.code = 404;
      throw error;
    }

    if (post.creator.toString() !== req.userId.toString()) {
      const error = new Error('Not authorized.');
      error.code = 403;
      throw error;
    }

    clearImage(post.imageUrl);

    await post.remove();

    const user = await User.findById(req.userId);

    user.posts.pull(id);

    await user.save();

    return true;
  },
  user: async function(args, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated.');
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error('No user found.');
      error.code = 404;
      throw error;
    }

    return { ...user._doc, _id: user._id.toString() };
  },
  updateStatus: async function({ status }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated.');
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error('No user found.');
      error.code = 404;
      throw error;
    }

    user.status = status;

    const updatedUser = await user.save();

    return { ...updatedUser._doc, _id: updatedUser._id.toString() };
  }
};
