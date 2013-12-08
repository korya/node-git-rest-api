var Q = require('q'),
    path = require('path'),
    dive = require('dive');

var ddive = function(divePath, options) {
  var deferred = Q.defer();
  var prefix = divePath ? divePath + path.sep : '';
  var files = [];

  dive(divePath, options, function(err, file) {
    if (err) {
      deferred.reject(err);
      return;
    }

    file = file.replace(prefix, '');
    files.push(file);
  }, function() {
    deferred.resolve(files);
  });

  return deferred.promise;
}

module.exports = ddive;
