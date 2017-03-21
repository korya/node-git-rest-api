# GIT REST API

[![Build Status](https://travis-ci.org/korya/node-git-rest-api.png?branch=master)](https://travis-ci.org/korya/node-git-rest-api)

The aim of the project is to provide a restful Git API that
mimics as most as possible the old good git.

For example, in order to commit a change in shell you should do:
```shell
$ mkdir new-project
$ cd new-project
$ git init
$ git add file.c
$ git commit -m 'A commit message'
$ git add file.c
$ git commit -m 'A second commit message'
$ git show HEAD~:file.c
```

In case of `git-rest-api` you should do:
```shell
POST /init
  { "repo": "new-project" }
POST /repo/new-project/tree/file.c
POST /repo/new-project/commit
  { "message": "A commit message" }
POST /repo/new-project/tree/file.c
POST /repo/new-project/commit
  { "message": "A second commit message" }
GET  /repo/new-project/show/file.c?rev=HEAD~
```

## Install

In your project install git-rest-api and express:
```shell
$ npm install git-rest-api
$ npm install express
```
## Environment variables
The following environment variables are supported:

* `PORT`: port to serve at, default is `8080`
* `PREFIX`: string prefix to serve repositories at, i.e. `http://localhost:[port]/[prefix]/repo/:repo/tree/:path`
* `TMPDIR`: name of temporary directory to use to cache repositories
* `LOGLEVEL`: log level for [winston](https://www.npmjs.com/package/winston#logging-levels) logger. Default is `error`

## Example servers

Example 1: A simple example of a server running `git-rest-api`:
```javascript
var app = require('express')(),
    git = require('git-rest-api');

git.init(app, { installMiddleware: true }).then(function () {
  app.listen(8080);
  console.log('Listening on', 8080);
});
```

Example 2: All actions on repositories are specific to the client session.
To share repositories between sessions/cookies, pass an existing path to `workDir` in the `init config`, e.g.
```javascript
mkdirp = require('mkdirp');
var WRKDIR = './wrk-test-git';
mkdirp.sync(WRKDIR, 0755);
git.init(app, { workDir: WRKDIR }).then(function () {
  ...
});
```

Example 3: For a dockerized version, check [docker-node-git-rest-api](https://github.com/shadiakiki1986/docker-node-git-rest-api)

## Example clients

* [git-rest-api-client-php](https://github.com/shadiakiki1986/git-rest-api-client-php)
 * Can also be used as a [flysystem](https://github.com/thephpleague/flysystem/) adapter via [flysystem-git](https://github.com/shadiakiki1986/flysystem-git)
 
## Testing
1. For direct testing on your local machine: `npm install` followed by `npm test`
2. For using the provided vagrant virtual environment: `cd vagrant` followed by `make`
3. To increase verbosity: `export LOGLEVEL=info`

## API
