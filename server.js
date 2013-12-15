var app = require('express')(),
    api = require('./rest-api');

var PORT = process.env['PORT'] || 8080;

api.init(app, {
  prefix: process.env['PREFIX'],
  tmpDir: process.env['TMPDIR'],
  installMiddleware: true,
}).then(function () {
  app.listen(PORT);
  console.log('Listening on', PORT);
}, function (err) {
  console.error(err);
});
