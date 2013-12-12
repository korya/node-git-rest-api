var Q = require('q'),
    mkdirp = require('mkdirp'),
    fs = require('fs');

function readdir(dirname) {
  return Q.nfcall(fs.readdir, dirname);
}

function readFile(filename, options) {
  return Q.nfcall(fs.readFile, filename, options);
}

function writeFile(filename, options) {
  return Q.nfcall(fs.writeFile, filename, options);
}

function rename(oldPath, newPath) {
  return Q.nfcall(fs.rename, oldPath, newPath);
}

function stat(path) {
  return Q.nfcall(fs.stat, path);
}

function exists(path) {
  var deferred = Q.defer();
  try {
    fs.exists(path, function (exists) {
      deferred.resolve(exists);
    });
  } catch (e) {
    deferred.reject(e);
  }
  return deferred.promise;
}

function mkdir(path, mode) {
  var deferred = Q.defer();
  fs.mkdir(path, mode, function (err) {
    if (err) deferred.reject();
    else deferred.resolve();
  });
  return deferred.promise;
}

function myMkdirp(path, mode) {
  var deferred = Q.defer();

  mkdirp(path, mode, function (err) {
    if (err) deferred.reject(err);
    else deferred.resolve();
  });

  return deferred.promise;
}

module.exports = {
  readdir: readdir,
  readFile: readFile,
  writeFile: writeFile,
  rename: rename,
  stat: stat,
  exists: exists,
  mkdir: mkdir,
  mkdirp: myMkdirp,
};
