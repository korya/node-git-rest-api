var express = require('express'),
    params = require('express-params'),
    fs = require('fs'),
    temp = require('temp'),
    git = require('./lib/git'),
    gitParser = require('./lib/git-parser'),
    addressParser = require('./lib/address-parser'),
    app = express();

params.extend(app);

config = {
  port: process.env['PORT'] || 8080,
  tmpDir: process.env['TMPDIR'] || '/tmp/git',
};

app.use(express.bodyParser());
app.use(express.cookieParser('a-random-string-comes-here'));

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

  if (!workDir || !fs.existsSync(workDir)) {
    // XXX who gonna clean it?
    workDir = temp.mkdirSync({ dir: config.tmpDir });
    res.cookie('workDir', workDir, { signed: true });
  }
  req.git.workDir = workDir;
  console.log('work dir:', req.git.workDir);

  next();
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
    // -> 404
    next('route');
    return;
  }

  workDir = req.git.workDir + '/' + repo;
  if (!fs.existsSync(workDir)) {
    // -> 404
    next('route');
    return;
  }

  req.git.tree.repo = repo;
  req.git.tree.workDir = workDir;
  console.log('repo dir:', req.git.tree.workDir);
  next();
}

function getFilePath(req, res, next) {
  // Path form: /git/tree/<repo>/<path>
  //           0  1   2     3      4
  var path = req.path.split('/').slice(4).join('/');
  req.git.file.path = path;
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

app.get('/git/', function(req, res) {
  console.log('list repositories');
  var repoList = fs.readdirSync(req.git.workDir);
  res.set('Content-Type', 'application/json');
  res.send(JSON.stringify(repoList));
});
/* POST /git/init
 * 
 * Request:
 * { "repo": <local-repo-name> }
 *
 * Response:
 * { ["error": <error>] }
 */
app.post('/git/init', function(req, res) {
  console.log('init repo:', req.body.repo);

  if (!getRepoName(req.body.repo)) {
      res.json(400, { error: 'Invalid repo name: ' + req.body.repo });
      return;
  }

  var repo = req.body.repo;
  var repoDir = req.git.workDir + '/' + repo;
  fs.exists(repoDir, function (exists) {
    if (exists) {
      res.json(400,
	{ error: 'A repository ' + repo + ' already exists' });
      return;
    }

    fs.mkdir(repoDir, function(err) {
      if (err) {
	var error = 'Cannot create ' + repo;
	console.log(error + '; dir:', repoDir, 'err:', JSON.stringify(err));
	res.json(500, { error: error });
	return;
      }

      git('init', repoDir)
	.fail(function(err) { res.json(500, { error: err.error }); })
	.done(function() { res.json(200, {}); });
    });
  });
});
/* POST /git/clone
 * 
 * Request:
 * { "remote": <remote-url> [, "repo": <local-repo-name>] }
 *
 * Response:
 * { ["error": <error>] }
 */
app.post('/git/clone', function(req, res) {
  console.log('clone repo');

  if (!req.body.remote) {
      res.json(400, { error: 'Empty remote url' });
      return;
  }

  var remote = addressParser.parseAddress(req.body.remote);
  var repo = req.body.repo ? req.body.repo : remote.shortProject;
  var workDir = req.git.workDir;
  var repoDir = workDir + '/' + repo;

  if (!getRepoName(repo)) {
      res.json(400, { error: 'Invalid repo name: ' + repo });
      return;
  }

  fs.exists(repoDir, function (exists) {
    if (exists) {
      res.json(400,
	{ error: 'A repository ' + repo + ' already exists' });
      return;
    }

    fs.mkdir(repoDir, function(err) {
      if (err) {
	var error = 'Cannot create ' + repo;
	console.log(error + '; dir:', repoDir, 'err:', JSON.stringify(err));
	res.json(500, { error: error });
	return;
      }

      res.setTimeout(2 * 60 * 60 * 1000); // 2 hours
      git('clone ' + remote.address + ' ' + repo, workDir)
	.fail(function(err) { res.json(500, { error: err.error }); })
	.done(function() { res.json(200, {}); });
    });
  });
});

/* GET /git/:repo/commit/:commit
 * 
 * Response:
 * {
 *   "sha": <COMMIT SHA1 HASH STRING>,
 *   "parents": [ <PARENT SHA1 HASH STRING>* ],
 *   "isMerge": <COMMIT IS A MERGE>,
 *   "author": <AUTHOR>,
 *   "authorDate": <AUTHOR DATE>,
 *   "committer": <COMMITTER>,
 *   "commitDate": <COMMIT DATE>,
 *   "title": <COMMIT TITLE>,
 *   "message": <COMMIT MESSAGE>,
 *   "file": [
 *     "action": ["added", "removed", "changed"],
 *     "path": <FILE PATH>
 *   ]
 * }
 *
 * Error:
 * { error: <ERROR STRING> }
 */
app.get('/git/:repo/commit/:commit', function(req, res) {
  var workDir = req.git.tree.workDir;
  var commit = req.params.commit[0];

  console.log('get commit info: ', commit, ', workDir:', workDir);
  git('show --decorate=full --pretty=fuller --parents ' + commit, workDir)
    .parser(gitParser.parseGitCommitShow)
    .fail(function(err) { res.json(500, { error: err.error }); })
    .done(function(commit) { res.json(200, commit); });
});

/* POST /git/:repo/tree/.git/checkout
 * 
 * Request:
 *  { "branch": <BRANCH NAME> }
 *
 * Response:
 * { ["error": <ERROR STRING>] }
 */
app.post('/git/:repo/tree/.git/checkout', function(req, res) {
  var workDir = req.git.tree.workDir;
  var branch = req.body.branch;

  if (!branch) {
    res.json(400, { error: 'No branch name is specified' });
    return;
  }

  console.log('checkout branch:', branch);
  fs.exists(workDir + '/.git/refs/heads/' + branch, function(exists) {
    if (!exists) {
      res.json(400, { error: 'Branch "' + branch + '" does not exist' });
      return;
    }

    git('checkout ' + branch, workDir)
      .fail(function(err) { res.json(500, { error: err.error }); })
      .done(function() { res.json(200, {}); });
  });
});
app.get('/git/:repo/tree/.git/commit', function(req, res) {
  console.log('commit branch');
  res.send("");
});
app.get('/git/:repo/tree/.git/push', function(req, res) {
  console.log('push branch to remote');
  res.send("");
});

app.get('/git/:repo/tree/*', [getFilePath, getRevision], function(req, res) {
  console.log('get file: ', JSON.stringify(req.git, null, 2));
  var contents = "";
  res.send(console);
});
app.post('/git/tree/:repo/*', getFilePath, function(req, res) {
  console.log('set file: ', JSON.stringify(req.git, null, 2));
  res.send("");
});
app.delete('/git/:repo/tree/*', getFilePath, function(req, res) {
  console.log('del file: ', JSON.stringify(req.git, null, 2));
  res.send("");
});

if (!fs.existsSync(config.tmpDir)) {
  console.log('Creating temp dir', config.tmpDir);
  var path = config.tmpDir.split('/');
  for (var i = 1; i <= path.length; i++) {
    var subPath = path.slice(0, i).join('/');
    if (!fs.existsSync(subPath)) {
      fs.mkdirSync(subPath);
    }
  }
}
app.listen(config.port);
console.log('Listening on', config.port);
