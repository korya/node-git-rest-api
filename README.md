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
POST /init?repo="new-project"
POST /repo/new-project/tree/file.c
POST /repo/new-project/commit?message="A commit message"
POST /repo/new-project/tree/file.c
POST /repo/new-project/commit?message="A second commit message"
GET  /repo/new-project/show/file.c?rev=HEAD~
```

## Install

In your project install git-rest-api and express:
```shell
$ npm install git-rest-api
$ npm install express
```

A simple example of a server running `git-rest-api`:
```javascript
var app = require('express')(),
    api = require('git-rest-api');

api.init(app, { installMiddleware: true }).then(function () {
  app.listen(8080);
  console.log('Listening on', 8080);
});
```

## Examples

## API
