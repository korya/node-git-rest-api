var winston = require('winston');

// singleton design pattern
var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({ level: process.env['LOGLEVEL'] || 'error' }),
    ],
  });

exports = module.exports = logger;
