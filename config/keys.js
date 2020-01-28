if (process.env.NODE_ENV === 'production') {
  module.exports = require('./production.keys');
} else {
  module.exports = require('./development.keys');
}
