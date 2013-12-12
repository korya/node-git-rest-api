var express = require('express'),
    params = require('express-params'),
    fs = require('fs'),
    path = require('path'),
    temp = require('temp'),
    Q = require('q'),
    dgit = require('./lib/deferred-git'),
    gitParser = require('./lib/git-parser'),
    addressParser = require('./lib/address-parser'),
    dfs = require('./lib/deferred-fs');

defaultConfig = {
  prefix: '',
  tmpDir: '/tmp/git',
  installMiddleware: false,
};

function mergeConfigs(dst, src) {
  /* XXX good enough */
  for (var p in src) {
    if (!src.hasOwnProperty(p) || src[p] === undefined) continue;
    if (dst.hasOwnProperty(p) && dst[p] !== undefined) continue;
    /* A property is not defined -- set the default value */
    dst[p] = src[p];
  }
}

exports.init = function(app, config) {

mergeConfigs(config, defaultConfig);
config.prefix = config.prefix.replace(/\/*$/, '');

/* XXX Should be replaced */
params.extend(app);

if (config.installMiddleware) {
  app.use(express.bodyParser({ uploadDir: '/tmp', keepExtensions: true }));
  app.use(express.methodOverride());
  app.use(express.cookieParser('a-random-string-comes-here'));
}

function prepareGitVars(req, res, next) {
  req.git = {
    workDir: undefined,
    tree: {},
    file: {},
  };
  next();
}

function getWorkdir(req, res, next) {
  var workDir = req.signedCookies.workDir;

  dfs.exists(workDir)
    .then(function (exists) { if (!exists) return Q.reject('not exists'); })
    .catch(function () {
      // XXX who gonna clean it?
      workDir = temp.mkdirSync({ dir: config.tmpDir });
      res.cookie('workDir', workDir, { signed: true });
    }).then(function() {
      req.git.workDir = workDir;
      console.log('work dir:', req.git.workDir);
      next();
    });
}

function getRepoName(val) {
  var match;
  if (!val) return null;
  match = /^[-._a-z0-9]*$/i.exec(String(val));
  return match ? match[0] : null;
}

function getRepo(req, res, next, val) {
  var repo, workDir;

  repo = getRepoName(val);
  if (!repo) {
    res.json(400, { error: "Illegal repo name: " + val });
    return;
  }

  workDir = req.git.workDir + '/' + repo;
  if (!fs.existsSync(workDir)) {
    res.json(400, { error: "Unknown repo: " + val });
    return;
  }

  req.git.tree.repo = repo;
  req.git.tree.workDir = workDir;
  console.log('repo dir:', req.git.tree.workDir);
  next();
}

function getFilePath(req, res, next) {
  // Path form: <PREFIX>/<repo>/tree/<path>
  //               0        1     2     3
  var pathNoPrefix = req.path.substr(config.prefix.length);
  var filePath = pathNoPrefix.split('/').slice(3).join(path.sep);

  console.log('path: ', filePath)
  /* get rid of trailing slash */
  filePath = path.normalize(filePath + '/_/..');
  if (filePath === '/') filePath = '';
  req.git.file.path = filePath;
  console.log('file path:', req.git.file.path);
  next();
}

function getRevision(req, res, next) {
  if (req.query.rev) {
    req.git.file.rev = req.query.rev;
    console.log('revision:', req.git.file.rev);
  }
  next();
}

app.use(prepareGitVars);
app.use(getWorkdir);
app.param('commit', /^[a-f0-9]{5,40}$/i);
app.param('repo', getRepo);

/* GET /
 *
 * Response:
 *   json: [ (<repo-name>)* ]
 * Error:
 *   json: { "error": <error> }
 */
app.get(config.prefix + '/', function(req, res) {
  var deferred = Q.defer();
  console.log('list repositories');
  dfs.readdir(req.git.workDir)
    .then(
      function(repoList) { res.json(repoList); },
      function(err) { reg.json(400, { error: err }); }
    );
});

/* POST /init
 * 
 * Request:
 *   json: { "repo": <local-repo-name> }
 *
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.post(config.prefix + '/init', function(req, res) {
  console.log('init repo:', req.body.repo);

  if (!getRepoName(req.body.repo)) {
      res.json(400, { error: 'Invalid repo name: ' + req.body.repo });
      return;
  }

  var repo = req.body.repo;
  var repoDir = path.join(req.git.workDir, repo);
  dfs.exists(repoDir)
    .then(function (exists) {
      if (exists) return Q.reject('A repository ' + repo + ' already exists');
    })
    .then(function() { return dfs.mkdir(repoDir); })
    .then(function() { return dgit('init', repoDir); })
    .then(
      function() { res.json(200, {}); },
      function(err) { res.json(400, { error: err }); }
    );
});

/* POST /clone
 * 
 * Request:
 * { "remote": <remote-url> (, "repo": <local-repo-name>) }
 *
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.post(config.prefix + '/clone', function(req, res) {
  console.log('clone repo:', req.body.remote);

  if (!req.body.remote) {
      res.json(400, { error: 'Empty remote url' });
      return;
  }

  var remote = addressParser.parseAddress(req.body.remote);
  var repo = req.body.repo || remote.shortProject;
  if (!getRepoName(repo)) {
      res.json(400, { error: 'Invalid repo name: ' + repo });
      return;
  }

  var workDir = req.git.workDir;
  var repoDir = path.join(workDir, repo);
  dfs.exists(repoDir)
    .then(function (exists) {
      if (exists) return Q.reject('A repository ' + repo + ' already exists');
    })
    .then(function() {
      return dgit('clone ' + remote.address + ' ' + repo, workDir);
    })
    .then(
      function() { res.json(200, {}); },
      function(err) { res.json(400, { error: err }); }
    );
});

/* POST /:repo/checkout
 * 
 * Request:
 *  { "branch": <branch name> }
 *
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.post(config.prefix + '/:repo/checkout', function(req, res) {
  var workDir = req.git.tree.workDir;
  var branch = req.body.branch;

  console.log('checkout branch:', branch);
  if (!branch) {
    res.json(400, { error: 'No branch name is specified' });
    return;
  }

  dfs.exists(workDir + '/.git/refs/heads/' + branch)
    .then(function (exists) {
      if (!exists) return Q.reject('Unknown branch ' + branch);
    })
    .then(function() {
      return dgit('checkout ' + branch, workDir);
    })
    .then(
      function() { res.json(200, {}); },
      function(err) { res.json(400, { error: err }); }
    );
});

/* GET /:repo/show/<path>?rev=<revision>
 *  `rev` -- can be any legal revision
 * 
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.get(config.prefix + '/:repo/show/*', [getFilePath, getRevision], function(req, res) {
  var workDir = req.git.tree.workDir;
  var rev = req.git.file.rev || 'HEAD';
  var file = req.git.file.path;

  dgit('show ' + rev + ':' + file, workDir)
    .then(
      function(data) { res.json(200, {}); },
      function(err) { res.json(400, { error: err }); }
    );
});

/* GET /:repo/ls-tree/<path>?rev=<revision>
 *  `rev` -- can be any legal revision
 * 
 * Response:
 *   json: [
 *     ({
 *       "name": <name>,
 *       "mode": <mode>,
 *       "sha": <sha>,
 *       "type": ("blob" or "tree"),
 *       "contents": (for trees only),
 *     })*
 *   ]
 * Error:
 *   json: { "error": <error> }
 */
app.get(config.prefix + '/:repo/ls-tree/*', [getFilePath, getRevision], function(req, res) {
  var workDir = req.git.tree.workDir;
  var rev = req.git.file.rev || 'HEAD';
  var file = req.git.file.path;

  dgit('ls-tree -tr ' + rev + ' ' + file, workDir, gitParser.parseLsTree)
    .then(function (obj) {
	if (!obj) return Q.reject('No such file ' + file + ' in ' + rev);
	return obj;
    })
    .then(
      function (obj) { res.json(200, obj); },
      function (err) { res.json(400, { error: err }); }
    );
});

/* GET /:repo/commit/:commit
 * 
 * Response:
 *   json: {
 *     "sha": <commit sha1 hash string>,
 *     "parents": [ (<parent sha1 hash string>)* ],
 *     "isMerge": <commit is a merge>,
 *     "author": <author>,
 *     "authorDate": <author date>,
 *     "committer": <committer>,
 *     "commitDate": <commit date>,
 *     "title": <commit title>,
 *     "message": <commit message>,
 *     "file": [
 *       "action": ("added", "removed" or "changed"),
 *       "path": <file path>
 *     ]
 *   }
 *
 * Error:
 *   json: { "error": <error> }
 */
app.get(config.prefix + '/:repo/commit/:commit', function(req, res) {
  var workDir = req.git.tree.workDir;
  var commit = req.params.commit[0];

  console.log('get commit info: ', commit, ', workDir:', workDir);
  dgit('show --decorate=full --pretty=fuller --parents ' + commit, workDir,
    gitParser.parseGitCommitShow).then(
      function(commit) { res.json(200, commit); },
      function(err) { res.json(500, { error: err.error }); }
    );
});

/* POST /:repo/commit?message=<commit-message>
 * 
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.post(config.prefix + '/:repo/commit', function(req, res) {
  var message = req.query.message;
  var workDir = req.git.tree.workDir;

  console.log('commit message:', message);
  if (!message) {
    res.json(400, { error: 'Empty commit message' });
    return;
  }

  dgit('commit -m ' + message , workDir)
    .then(
      function () { res.json(200, {}); },
      function (err) { res.json(400, { error: err }); }
    );
});

/* POST /:repo/push
 * 
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.post(config.prefix + '/:repo/push', function(req, res) {
  dgit('push', workDir)
    .then(
      function (obj) { res.json(200, obj); },
      function (err) { res.json(400, { error: err }); }
    );
});

/* GET /:repo/tree/<path>
 * 
 * Response:
 *   json: {
 *     "name": <name>,
 *     "type": ("dir" or "file"),
 *     "status": '', (XXX not implemented)
 *     "contents": (for dirs only)
 *   }
 * Error:
 *   json: { "error": <error> }
 */
app.get(config.prefix + '/:repo/tree/*', getFilePath, function(req, res) {
  var workDir = req.git.tree.workDir;
  var file = req.git.file.path;
  var fileFullPath = path.join(workDir, file);

  console.log('get file: ' + file);
  dfs.exists(fileFullPath)
    .then(function (exists) {
      if (!exists) return Q.reject('No such file: ' + fileFullPath);
    })
    .then(function() { return dfs.stat(fileFullPath) })
    .then(function(stats) {
      if (stats.isFile()) {
        return dfs.readFile(fileFullPath)
	  .then(function (buffer) { res.send(200, buffer); });
      }
      if (stats.isDirectory()) {
	return dgit.lsR(fileFullPath)
	  .then(function (obj) { res.json(200, obj); });
      }
      return Q.reject('Not a regular file or a directory ' + file);
    })
    .catch(function (err) { res.json(400, { error: err }); });
});

/* PUT /:repo/tree/<path>
 * 
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.put(config.prefix + '/:repo/tree/*', getFilePath, function(req, res) {
  var workDir = req.git.tree.workDir;
  var file = req.git.file.path;
  var fileFullPath = path.join(workDir, file);
  var tmpPath = req.files && req.files.file ? req.files.file.path : null;

  if (!tmpPath) {
    res.json(400, { error: 'No file uploaded' });
    return;
  }

  dfs.exists(fileFullPath)
    .then(function (exists) {
      if (!exists) return dfs.mkdirp(path.dirname(fileFullPath), 0755);
      return dfs.stat(fileFullPath).then(function (stats) {
	if (!stats.isFile()) return Q.reject('Not a regular file: ' + file);
      });
    })
    .then(function () { return dfs.rename(tmpPath, path.join(workDir, file)); })
    .then(function() { return dgit('add ' + file, workDir); })
    .then(
      function () { res.json(200, {}); },
      function (err) { res.json(400, { error: err }); }
    );
});

/* DELETE /:repo/tree/<path>
 * 
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.delete(config.prefix + '/:repo/tree/*', getFilePath, function(req, res) {
  var workDir = req.git.tree.workDir;
  var file = req.git.file.path;

  console.log('del file:', file);
  dgit('rm -rf ' + file, workDir)
    .then(
      function () { res.json(200, {}); },
      function (err) { res.json(400, { error: err }); }
    );
});

if (!fs.existsSync(config.tmpDir)) {
  console.log('Creating temp dir', config.tmpDir);
  mkdirp.sync(config.tmpDir, 0755, function(err) {
    if (err) { console.err(err); process.exit(1); }
  });
}

} /* exports.init */
