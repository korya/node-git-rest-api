var express = require('express'),
    fs = require('fs'),
    path = require('path'),
    temp = require('temp'),
    Q = require('q'),
    logger = require('./lib/logger'),
    dgit = require('./lib/deferred-git'),
    gitParser = require('./lib/git-parser'),
    addressParser = require('./lib/address-parser'),
    dfs = require('./lib/deferred-fs'),
    methodOverride = require('method-override');

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

function logResponseBody(req, res, next) {
  var oldWrite = res.write,
      oldEnd = res.end;
  var chunks = [];

  res.write = function (chunk) {
    chunks.push(chunk);
    oldWrite.apply(res, arguments);
  };

  res.end = function (chunk) {
    if (chunk) chunks.push(Buffer.from(chunk));
    var body = Buffer.concat(chunks).toString('utf8');
    logger.info(req.path, body);
    oldEnd.apply(res, arguments);
  };

  next();
}

exports.init = function(app, config) {

mergeConfigs(config, defaultConfig);
config.prefix = config.prefix.replace(/\/*$/, '');

if (config.installMiddleware) {
  if (config.verbose) {
    app.use(logResponseBody);
  }
  app.use(express.bodyParser({ uploadDir: '/tmp', keepExtensions: true }));
  app.use(methodOverride());
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
  var workDir = config.workDir?config.workDir:req.signedCookies.workDir;

  dfs.exists(workDir)
    .then(function (exists) { if (!exists) return Q.reject('not exists'); })
    .catch(function () {
      // XXX who gonna clean it?
      workDir = temp.mkdirSync({ dir: config.tmpDir });
      res.cookie('workDir', workDir, { signed: true });
    }).then(function() {
      req.git.workDir = workDir;
      logger.info('work dir:', req.git.workDir);
      next();
    });
}

function getRepoName(val) {
  var match;
  if (!val) return null;
  match = /^[-._a-z0-9]*$/i.exec(String(val));
  return match ? match[0] : null;
}

function getRepo(req, res, next) {
  var repo = req.params.repo;
  var repoDir = path.join(req.git.workDir, repo);

  dfs.exists(repoDir).then(function (exists) {
    if (!exists) {
      res.status(400).json({ error: "Unknown repo: " + repo });
      return;
    }

    req.git.tree.repo = repo;
    req.git.tree.repoDir = repoDir;
    logger.info('repo dir:', req.git.tree.repoDir);
    next();
  });
}

// http://stackoverflow.com/a/4458580/4126114
function urldecode(str) {
  return decodeURIComponent((str+'').replace(/\+/g, '%20'));
}

function getFilePath(req, res, next) {
  // Path form: <PREFIX>/repo/<repo>/tree/<path>
  //               0      1     2     3     4
  var pathNoPrefix = req.path.substr(config.prefix.length);
  var filePath = pathNoPrefix.split('/').slice(4).join(path.sep);
  filePath = urldecode(filePath);

  logger.info('path: ', filePath)
  /* get rid of trailing slash */
  filePath = path.normalize(filePath + '/_/..');
  if (filePath === '/') filePath = '';
  req.git.file.path = filePath;
  logger.info('file path:', req.git.file.path);
  next();
}

function getRevision(req, res, next) {
  if (req.query.rev) {
    req.git.file.rev = req.query.rev;
    logger.info('revision:', req.git.file.rev);
  }
  next();
}

app.param('commit', function (req, res, next, val) {
  var match = /^[a-f0-9]{5,40}$/i.exec(String(val));
  if (!match) {
    res.status(400).json({ error: "Illegal commit name: " + val });
    return;
  }
  next();
});
app.param('repo', function (req, res, next, val) {
  logger.info('repo:', val);
  if (!getRepoName(val)) {
    res.status(400).json({ error: "Illegal repo name: " + val });
    return;
  }
  next();
});

/* GET /
 *
 * Response:
 *   json: [ (<repo-name>)* ]
 * Error:
 *   json: { "error": <error> }
 */
app.get(config.prefix + '/',
  [prepareGitVars, getWorkdir],
  function(req, res)
{
  var workDir = req.git.workDir;

  logger.info('list repositories');

  dfs.readdir(workDir)
    .then(
      function(repoList) { res.json(repoList); },
      function(error) { reg.json(400, { error: error }); }
    );
});

/* POST /init
 * 
 * Request:
 *   json: {
 *     "repo": <local-repo-name>,
 *     ("bare": <bool, --bare>,)
 *     ("shared": <bool, --share>,)
 *   }
 * Response:
 *   json: { "repo": <local repo name> }
 * Error:
 *   json: { "error": <error> }
 */
app.post(config.prefix + '/init',
  [prepareGitVars, getWorkdir],
  function(req, res)
{
  var repo = req.body.repo || '';
  var bare = req.body.bare ? '--bare' : '';
  var shared = req.body.shared ? '--shared' : '';

  logger.info('init repo:', repo, bare, shared, ';', req.git);

  if (!getRepoName(repo)) {
      res.status(400).json({ error: 'Invalid repo name: ' + repo });
      return;
  }

  var repoDir = path.join(req.git.workDir, repo);
  dfs.exists(repoDir)
    .then(function (exists) {
      if (exists) return Q.reject('A repository ' + repo + ' already exists');
    })
    .then(function() { return dfs.mkdir(repoDir); })
    .then(function() {
      return dgit('init ' + bare + ' ' + shared, repoDir);
    }).then(
      function() { res.status(200).json({ repo: repo }); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* POST /clone
 * 
 * Request:
 *   json: {
 *     "remote": <remote-url>,
 *     ("repo": <local-repo-name>,)
 *     ("bare": <git's --bare>,)
 *     ("depth": <git's --depth>,)
 *   }
 *
 * Response:
 *   json: { "repo": <local repo name> }
 * Error:
 *   json: { "error": <error> }
 */
app.post(config.prefix + '/clone',
  [prepareGitVars, getWorkdir],
  function(req, res)
{
  logger.info('clone repo:', req.body.remote);

  if (!req.body.remote) {
      res.status(400).json({ error: 'Empty remote url' });
      return;
  }

  var remote = addressParser.parseAddress(req.body.remote);
  var repo = req.body.repo || remote.shortProject;
  if (!getRepoName(repo)) {
      res.status(400).json({ error: 'Invalid repo name: ' + repo });
      return;
  }

  var workDir = req.git.workDir;
  var repoDir = path.join(workDir, repo);
  var flags = '';

  if (req.body.bare) flags = flags + ' --bare';
  if (req.body.depth) flags = flags + ' --depth ' + req.body.depth;

  dfs.exists(repoDir)
    .then(function (exists) {
      if (exists) return Q.reject('A repository ' + repo + ' already exists');
    })
    .then(function() {
      return dgit('clone ' + flags + ' ' + remote.address + ' ' + repo, workDir);
    })
    .then(
      function() { res.status(200).json({ repo: repo }); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* DELETE /repo/:repo
 *
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.delete(config.prefix + '/repo/:repo',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;

  logger.info('delete repo:', req.git.tree.repo);

  dfs.rmrfdir(repoDir)
    .then(
      function() { res.status(200).json({}); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* GET /repo/:repo/config?name=<option name>
 *
 * Response:
 *   json: {
 *     "values": [<option value>*]
 *   }
 * Error:
 *   json: { "error": <error> }
 */
app.get(config.prefix + '/repo/:repo/config',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var name = req.query.name || '';

  logger.info('config get', name);

  dgit('config --local --get-all ' + name, repoDir, gitParser.parseGitConfig)
    .then(
      function(values) { res.status(200).json({ values: values }); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* POST /repo/:repo/config
 *
 * Requst:
 *   json: {
 *     "name": <option name>,
 *     "value": <option value>,
 *   }
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.post(config.prefix + '/repo/:repo/config',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var name = req.body.name || '';
  var value = req.body.value || '';

  logger.info('config add', name, value);

  dgit('config --local --add ' + name + ' "' + value + '"', repoDir)
    .then(
      function() { res.status(200).json({}); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* PUT /repo/:repo/config
 *
 * Requst:
 *   json: {
 *     "name": <option name>,
 *     "value": <option value>,
 *   }
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.put(config.prefix + '/repo/:repo/config',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var name = req.body.name || '';
  var value = req.body.value || '';

  logger.info('config add', name, value);

  dgit('config --local --replace-all ' + name + ' "' + value + '"', repoDir)
    .then(
      function() { res.status(200).json({}); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* DELETE /repo/:repo/config
 *
 * Requst:
 *   json: {
 *     "name": <option name>,
 *     "unset-all": <whether unset all values>,
 *   }
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.delete(config.prefix + '/repo/:repo/config',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var name = req.body.name || '';
  var unset = '--unset';

  logger.info('config unset', name);

  if (req.body['unset-all']) unset = '--unset-all';

  dgit('config --local ' + unset + ' ' + name, repoDir)
    .then(
      function() { res.status(200).json({}); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* GET /repo/:repo/remote
 *
 * Response:
 *   json: {
 *     [
 *       ({
 *         "name": <remote name>,
 *         "url": <remote URL>
 *       })*
 *     ]
 *   }
 * Error:
 *   json: { "error": <error> }
 */
app.get(config.prefix + '/repo/:repo/remote',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;

  logger.info('list remotes');

  dgit('remote -v', repoDir, gitParser.parseGitRemotes)
    .then(
      function(remotes) { res.status(200).json(remotes); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* POST /repo/:repo/remote
 *
 * Request:
 *   json: {
 *     "name": <remote name>,
 *     "url": <remote URL>
 *   }
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.post(config.prefix + '/repo/:repo/remote',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var name = req.body.name || '';
  var url = req.body.url || '';

  logger.info('add remote', name, url);

  dgit('remote add ' + name + ' ' + url, repoDir)
    .then(
      function() { res.status(200).json({}); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* DELETE /repo/:repo/remote
 *
 * Request:
 *   json: {
 *     "name": <remote name>
 *   }
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.delete(config.prefix + '/repo/:repo/remote',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var name = req.body.name;

  logger.info('rem remote', name);

  dgit('remote rm ' + name, repoDir)
    .then(
      function() { res.status(200).json({}); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* GET /repo/:repo/branch
 *
 * Response:
 *   json: {
 *     [
 *       ({
 *         "name": <branch name>,
 *         "current": (true or false)
 *       })*
 *     ]
 *   }
 * Error:
 *   json: { "error": <error> }
 */
app.get(config.prefix + '/repo/:repo/branch',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;

  logger.info('list branches');

  dgit('branch --list', repoDir, gitParser.parseGitBranches)
    .then(
      function(branches) { res.status(200).json(branches); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* POST /repo/:repo/branch
 * 
 * Request:
 *  { "branch": <branch name> }
 *
 * Response:
 *   json: { "branch": <branch name> }
 * Error:
 *   json: { "error": <error> }
 */
app.post(config.prefix + '/repo/:repo/branch',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var branch = req.body.branch;

  logger.info('create branch:', branch);

  if (!branch) {
    res.status(400).json({ error: 'No branch name is specified' });
    return;
  }

  dgit('branch ' + branch, repoDir)
    .then(
      function() { res.status(200).json({ branch: branch }); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* POST /repo/:repo/checkout
 * 
 * Request:
 *  { "branch": <branch name> }
 *
 * Response:
 *   json: { "branch": <branch name> }
 * Error:
 *   json: { "error": <error> }
 */
app.post(config.prefix + '/repo/:repo/checkout',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var branch = req.body.branch;

  logger.info('checkout branch:', branch);

  if (!branch) {
    res.status(400).json({ error: 'No branch name is specified' });
    return;
  }

  dfs.exists(repoDir + '/.git/refs/heads/' + branch)
    .then(function (exists) {
      if (!exists) return Q.reject('Unknown branch ' + branch);
    })
    .then(function() {
      return dgit('checkout ' + branch, repoDir);
    })
    .then(
      function() { res.status(200).json({ branch: branch }); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* POST /repo/:repo/mv
 * 
 * Request:
 *  json: {
 *    "source": <path>,
 *    "destination": <path>
 *  }
 *
 * Response:
 *   json: { "branch": <branch name> }
 * Error:
 *   json: { "error": <error> }
 */
app.post(config.prefix + '/repo/:repo/mv',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var src = req.body.source;
  var dst = req.body.destination;

  logger.info('move: ', src, '->', dst);

  dgit('mv ' + src + ' ' + dst, repoDir)
    .then(
      function() { res.status(200).json({}); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* GET /repo/:repo/show/<path>?rev=<revision>
 *  `rev` -- can be any legal revision
 * 
 * Response:
 *   <file contents>
 * Error:
 *   json: { "error": <error> }
 */
app.get(config.prefix + '/repo/:repo/show/*',
  [prepareGitVars, getWorkdir, getRepo, getFilePath, getRevision],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var rev = req.git.file.rev || 'HEAD';
  var file = req.git.file.path;

  dgit('show ' + rev + ':' + file, repoDir)
    .then(
      function(data) { res.status(200).send(data); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* GET /repo/:repo/ls-tree/<path>?rev=<revision>
 *  `rev` -- can be any legal revision
 * 
 * Request:
 *   json: {
 *     ("t": <git ls-tree's -t>,)
 *     ("r": <git ls-tree's -r>,)
 *   }
 *
 * Response:
 *   json: [
 *     ({
 *       "name": <name>,
 *       "mode": <mode>,
 *       "sha1": <sha>,
 *       "type": ("blob" or "tree"),
 *       "contents": (for trees only),
 *     })*
 *   ]
 * Error:
 *   json: { "error": <error> }
 */
app.get(config.prefix + '/repo/:repo/ls-tree/*',
  [prepareGitVars, getWorkdir, getRepo, getFilePath, getRevision],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var rev = req.git.file.rev || 'HEAD';
  var file = req.git.file.path;

  var flags = '';
  if (req.body.t) flags = flags + ' -t';
  if (req.body.r) flags = flags + ' -r';

  dgit('ls-tree' + flags + ' ' + rev + ' "' + file + '"', repoDir, gitParser.parseLsTreeSimple)
    .then(function (obj) {
	if (!obj) return Q.reject('No such file ' + file + ' in ' + rev);
	return obj;
    })
    .then(
      function (obj) { res.status(200).json(obj); },
      function (error) { res.status(400).json({ error: error }); }
    );
});

/* GET /repo/:repo/commit/:commit
 * 
 * Response:
 *   json: {
 *     "sha1": <commit sha1 hash string>,
 *     "parents": [ (<parent sha1 hash string>)* ],
 *     "isMerge": <commit is a merge>,
 *     "author": <author>,
 *     "authorDate": <author date>,
 *     "committer": <committer>,
 *     "commitDate": <commit date>,
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
app.get(config.prefix + '/repo/:repo/commit/:commit',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var commit = req.params.commit;

  logger.info('get commit info: ', commit, ', repoDir:', repoDir);

  dgit('show --decorate=full --pretty=fuller --parents ' + commit, repoDir,
    gitParser.parseGitCommitShow).then(
      function(commit) { res.status(200).json(commit); },
      function(error) { res.status(500).json({ error: error }); }
    );
});

/* GET /repo/:repo/diff/<path>?commit1=<sha1>&commit2=<sha1>&cached
 *  `sha1` -- sha1 hash string
 * 
 * Response:
 *   <output of git diff file commit1 commit2>
 * Error:
 *   json: { "error": <error> }
 */
app.get(config.prefix + '/repo/:repo/diff/*',
  [prepareGitVars, getWorkdir, getRepo, getFilePath],
  function(req, res)
{
  var cmdArgs = '';
  var cmdOptions = '';
  var repoDir = req.git.tree.repoDir;

  if(req.query.commit1) cmdArgs += req.query.commit1 + ' ';
  if(req.query.commit2) cmdArgs += req.query.commit2 + ' ';
  if(req.git.file.path) cmdArgs += '-- ' + req.git.file.path + ' ';

  if (req.query.cached) cmdOptions += '--cached ';

  dgit('diff ' + cmdOptions + cmdArgs, repoDir)
    .then(
      function(data) { res.status(200).send(data); },
      function(error) { res.status(400).json({ error: error }); }
    );
});

/* GET /repo/:repo/log?revRange=<git log's revision range>
 *
 * Response:
 *   json: [
 *     ({
 *       refs: [],
 *       sha1: <commit sha1 hash string>,
 *       parents: [ (<parent sha1 hash string>)* ],
 *       authorName: <author name>,
 *       authorEmail: <author email>',
 *       authorDate: <author date>,
 *       committerName: <committer name>,
 *       committerEmail: <committer email>,
 *       commitDate: <commit date>,
 *       message: <commit message>
 *     })*
 *   ]
 * Error:
 *   json: { "error": <error> }
 */
app.get(config.prefix + '/repo/:repo/log',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var message = req.body.message;
  var repoDir = req.git.tree.repoDir;

  logger.info('log');

  var flags = '';

  if (req.query.revRange) flags = flags + ' ' + req.query.revRange;

  dgit('log  --decorate=full --pretty=fuller --all --parents' + flags, repoDir,
    gitParser.parseGitLog).then(
      function (log) { res.status(200).json(log); },
      function (error) { res.status(400).json({ error: error }); }
    );
});

/* POST /repo/:repo/commit
 * 
 * Request:
 *  json: {
 *    "allow-empty": (true or false),
 *    "message": <commit message>
 *  }
 *
 * Response:
 *   json: {
 *     "branch": <branch name>,
 *     "sha1": <commit sha>,
 *     "title": <commit title>
 *   }
 * Error:
 *   json: { "error": <error> }
 */
app.post(config.prefix + '/repo/:repo/commit',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var message = req.body.message;
  var repoDir = req.git.tree.repoDir;
  var cmdOptions = '';

  logger.info('commit message:', message);

  if (!message) {
    res.status(400).json({ error: 'Empty commit message' });
    return;
  }

  cmdOptions = '-m "' + message + '"';
  if (req.body['allow-empty']) cmdOptions += ' --allow-empty';

  dgit('commit ' + cmdOptions, repoDir, gitParser.parseCommit)
    .then(
      function (commit) { res.status(200).json(commit); },
      function (error) { res.status(400).json({ error: error }); }
    );
});

/* POST /repo/:repo/push
 * 
 * Request:
 *   json: { ({"remote": <remote name>, "branch": <branch name>}) }
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.post(config.prefix + '/repo/:repo/push',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var remote = req.body.remote || 'origin';
  var branch = req.body.branch || '';

  dgit('push ' + remote + ' ' + branch, repoDir)
    .then(
      function (obj) { res.status(200).json(obj); },
      function (error) { res.status(400).json({ error: error }); }
    );
});

/* POST /repo/:repo/pull
 * 
 * Request:
 *   json: { ({"remote": <remote name>, "branch": <branch name>}) }
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.post(config.prefix + '/repo/:repo/pull',
  [prepareGitVars, getWorkdir, getRepo],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var remote = req.body.remote || 'origin';
  var branch = req.body.branch || '';

  dgit('pull ' + remote + ' ' + branch, repoDir)
    .then(
      function (obj) { res.status(200).json({ message: obj.trim() }); },
      function (error) { res.status(400).json({ error: error }); }
    );
});

/* GET /repo/:repo/tree/<path>
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
app.get(config.prefix + '/repo/:repo/tree/*',
  [prepareGitVars, getWorkdir, getRepo, getFilePath],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var file = req.git.file.path;
  var fileFullPath = path.join(repoDir, file);

  logger.info('get file: ' + file);

  dfs.exists(fileFullPath)
    .then(function (exists) {
      if (!exists) return Q.reject('No such file: ' + fileFullPath);
    })
    .then(function() { return dfs.stat(fileFullPath) })
    .then(function(stats) {
      if (stats.isFile()) {
        return dfs.readFile(fileFullPath)
	  .then(function (buffer) { res.status(200).send(buffer); });
      }
      if (stats.isDirectory()) {
	return dgit.lsR(fileFullPath)
	  .then(function (obj) { res.status(200).json(obj); });
      }
      return Q.reject('Not a regular file or a directory ' + file);
    })
    .catch(function (error) { res.status(400).json({ error: error }); });
});

/* PUT /repo/:repo/tree/<path>
 * 
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.put(config.prefix + '/repo/:repo/tree/*',
  [prepareGitVars, getWorkdir, getRepo, getFilePath],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var file = req.git.file.path;
  var fileFullPath = path.join(repoDir, file);
  var tmpPath = req.files && req.files.file ? req.files.file.path : null;

  if (!tmpPath) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  dfs.exists(fileFullPath)
    .then(function (exists) {
      if (!exists) return dfs.mkdirp(path.dirname(fileFullPath), 0755);
      return dfs.stat(fileFullPath).then(function (stats) {
	if (!stats.isFile()) return Q.reject('Not a regular file: ' + file);
      });
    })
    .then(function () {
      var dstPath = path.join(repoDir, file);
      /* If rename fails, try to copy the file. Rename plays with links and
       * hence can fail when the source and the destination lye on different
       * file systems.
       */
      return dfs.rename(tmpPath, dstPath)
        .catch(function (err) { return dfs.copy(tmpPath, dstPath); });
      })
    .then(function() { return dgit('add "' + file + '"', repoDir); })
    .then(
      function () { res.status(200).json({}); },
      function (error) { res.status(400).json({ error: error }); }
    );
});

/* DELETE /repo/:repo/tree/<path>
 * 
 * Response:
 *   json: {}
 * Error:
 *   json: { "error": <error> }
 */
app.delete(config.prefix + '/repo/:repo/tree/*',
  [prepareGitVars, getWorkdir, getRepo, getFilePath],
  function(req, res)
{
  var repoDir = req.git.tree.repoDir;
  var file = req.git.file.path;

  logger.info('del file:', file);

  dgit('rm -rf ' + file, repoDir)
    .then(
      function () { res.status(200).json({}); },
      function (error) { res.status(400).json({ error: error }); }
    );
});

return dgit('--version', '.')
  .then(function(data) {
    logger.warn(' ++++ ', data);
  }, function (err) {
    logger.warn('git version: error:', err);
  })
  .then(function () {
    return dfs.exists(config.tmpDir);
  })
  .then(function (exists) {
    if (exists) return;
    return dfs.mkdirp(config.tmpDir, 0755);
  });
} /* exports.init */
