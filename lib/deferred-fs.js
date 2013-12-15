var Q = require('q'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
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

function copy(oldPath, newPath) {
  var deferred = Q.defer();

  try {
    var rs = fs.createReadStream(oldPath);
    var ws = fs.createWriteStream(newPath);
    rs.on("error", function(err) { deferred.reject(err); });
    ws.on("error", function(err) { deferred.reject(err); });
    ws.on("close", function() { deferred.resolve(); });
    rs.pipe(ws);
  } catch (err) {
    deferred.reject(err);
  }

  return deferred.promise;
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
  return Q.nfcall(fs.mkdir, path, mode);
}

function myMkdirp(path, mode) {
  return Q.nfcall(mkdirp, path, mode);
}

function rmrfdir(path) {
  return Q.nfcall(rimraf, path);
}

module.exports = {
  readdir: readdir,
  readFile: readFile,
  writeFile: writeFile,
  rename: rename,
  copy: copy,
  stat: stat,
  exists: exists,
  mkdir: mkdir,
  mkdirp: myMkdirp,
  rmrfdir: rmrfdir,
};
