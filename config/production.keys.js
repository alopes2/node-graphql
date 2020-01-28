const keys = {
  mongoUri: `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}R@generic-free-87m2x.mongodb.net/${process.env.MONGO_DATABASE}?retryWrites=true&w=majority`,
  jwtSecret: process.env.JWT_SECRET
};

module.exports = keys;