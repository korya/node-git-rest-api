var express = require('express'),
    params = require('express-params'),
    fs = require('fs'),
    temp = require('temp'),
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

  if (!workDir) {
    // XXX who gonna clean it?
    var workDir = temp.mkdirSync({ dir: config.tmpDir });
    res.cookie('workDir', workDir, { signed: true });
  }
  req.git.workDir = workDir;
  console.log('work dir:', req.git.workDir);

  next();
}

function getRepo(req, res, next, val) {
  var match = /^[-._a-z0-9]*$/i.exec(String(val));
  var repo, workDir;
  if (!match) {
    // -> 404
    next('route');
    return;
  }

  repo = match[0];
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
app.post('/git/init', function(req, res) {
  console.log('init repo');
  var repo = {};
  res.set('Content-Type', 'application/json');
  res.send(JSON.stringify(repo));
});
app.post('/git/clone', function(req, res) {
  console.log('clone repo');
  var repo = {};
  res.set('Content-Type', 'application/json');
  res.send(JSON.stringify(repo));
});

app.get('/git/commit/:commit', function(req, res) {
  console.log('get commit info: ', req.route);
  var commit = {};
  res.set('Content-Type', 'application/json');
  res.send(JSON.stringify(commit));
});

app.get('/git/tree/:repo/.git/checkout', function(req, res) {
  console.log('checkout branch');
  res.send("");
});
app.get('/git/tree/:repo/.git/commit', function(req, res) {
  console.log('commit branch');
  res.send("");
});
app.get('/git/tree/:repo/.git/push', function(req, res) {
  console.log('push branch to remote');
  res.send("");
});

app.get('/git/tree/:repo/*', [getFilePath, getRevision], function(req, res) {
  console.log('get file: ', JSON.stringify(req.git, null, 2));
  var contents = "";
  res.send(console);
});
app.post('/git/tree/:repo/*', getFilePath, function(req, res) {
  console.log('set file: ', JSON.stringify(req.git, null, 2));
  res.send("");
});
app.delete('/git/tree/:repo/*', getFilePath, function(req, res) {
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
