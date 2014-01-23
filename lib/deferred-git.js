var Q = require('q'),
    path = require('path'),
    ddive = require('./deferred-dive'),
    git = require('./git');

var dgit = function(command, repoPath, parser) {
  var deferred = Q.defer();
  var gitTask = git(command, repoPath);

  if (parser) gitTask.parser(parser);
  /* Some commands fail with no error message */
  gitTask.fail(function(err) { deferred.reject(err.stderr || err.message); })
  gitTask.done(function(res) { deferred.resolve(res); });

  return deferred.promise;
};

dgit.lsR = function(dirname) {
  var deferred = Q.defer();
  var absPath = path.join(process.cwd(), dirname);
  var tree = { contents: [] };
  var index = { ".": tree };

  /* XXX multiple instances of `dive()` cannot run simultaneously. */
  ddive(absPath, { directories: true, files: false })
    .then(function (dirIndex) {
      dirIndex.forEach(function (d) {
	var obj = {
	  name: path.basename(d),
	  type: 'dir',
	  contents: [],
	};
	var parentDir = path.dirname(d) ? path.dirname(d) : '.';

	index[parentDir].contents.push(obj);
	index[d] = obj;
      });

      /* Now scan the files */
      return ddive(absPath, { directories: false, files: true });
    })
    .then(function (fileIndex) {
      fileIndex.forEach(function (f) {
	var obj = {
	  name: path.basename(f),
	  type: 'file',
	};
	var parentDir = path.dirname(f) ? path.dirname(f) : '.';

	index[parentDir].contents.push(obj);
      });

      deferred.resolve(tree.contents);
    }, function (err) { deferred.reject(err); });

  return deferred.promise;
}

module.exports = dgit;
