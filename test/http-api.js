var request = require('supertest'),
    should = require('should'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    fs = require('fs'),
    api = require('../rest-api');

describe('API:', function () {
  var TMPDIR = './tmp-test-git';
  var PORT = 9854;
  var URL = 'http://localhost:' + PORT;
  var server;

  before(function (done) {
    mkdirp(TMPDIR, 0755, done);
  });

  after(function (done) {
    rimraf(TMPDIR, done);
  });

  beforeEach(function (done) {
    var app = require('express')();
    api.init(app, {
      prefix: '',
      tmpDir: TMPDIR,
      installMiddleware: true,
    });
    server = require('http').createServer(app).listen(PORT);
    console.log('Listening on', PORT);
    done();
  });

  afterEach(function (done) {
    server.close();
    done();
  });

  describe('HTTP layer: replies are JSONs', function () {
    it('GET / should reply with json', function (done) {
      request(URL)
	.get('/')
	.expect('Content-Type', /json/, done);
    });

    it('POST /init should reply with json', function (done) {
      request(URL)
	.post('/init')
        .send()
	.expect('Content-Type', /json/, done);
    });

    it('POST /clone should reply with json', function (done) {
      request(URL)
	.post('/clone')
        .send()
	.expect('Content-Type', /json/, done);
    });

    it('POST /:repo/checkout should reply with json', function (done) {
      request(URL)
	.post('/:repo/checkout')
        .send()
	.expect('Content-Type', /json/, done);
    });

    it('GET /:repo/show/:path should reply with json', function (done) {
      request(URL)
	.get('/:repo/show/:path')
	.expect('Content-Type', /json/, done);
    });

    it('GET /:repo/ls-tree/:path should reply with json', function (done) {
      request(URL)
	.get('/:repo/ls-tree/:path')
	.expect('Content-Type', /json/, done);
    });

    it('GET /:repo/commit/:commit should reply with json', function (done) {
      request(URL)
	.get('/:repo/commit/:commit')
	.expect('Content-Type', /json/, done);
    });

    it('POST /:repo/commit should reply with json', function (done) {
      request(URL)
	.post('/:repo/commit')
        .send()
	.expect('Content-Type', /json/, done);
    });

    it('POST /:repo/push should reply with json', function (done) {
      request(URL)
	.post('/:repo/push')
        .send()
	.expect('Content-Type', /json/, done);
    });

    it('GET /:repo/tree/:path should reply with json', function (done) {
      request(URL)
	.get('/:repo/tree/:path')
	.expect('Content-Type', /json/, done);
    });

    it('PUT /:repo/tree/:path should reply with json', function (done) {
      request(URL)
	.put('/:repo/tree/:path')
        .send()
	.expect('Content-Type', /json/, done);
    });

    it('DELETE /:repo/tree/:path should reply with json', function (done) {
      request(URL)
	.del('/:repo/tree/:path')
        .send()
	.expect('Content-Type', /json/, done);
    });
  });

  describe('GET /', function () {
    it('should return empty list of repositories');
  });
  describe('POST /git/init', function () {
    it('should init a new repository');
  });
  describe('POST /git/clone', function () {
    it('should clone a remote repository');
  });
  describe('POST /git/:repo/checkout', function () {
    it('should checkout a branch in a local repository');
  });
  describe('GET /git/:repo/show/<path>', function () {
    it('should show a contents of a given path');
  });
  describe('GET /git/:repo/ls-tree/<path>', function () {
    it('should list a tree of a given path');
  });
  describe('GET /git/:repo/commit/:commit', function () {
    it('should return a commit by its sha1');
  });
  describe('POST /git/:repo/commit', function () {
    it('should commit changes in a given tree');
  });
  describe('POST /git/:repo/push', function () {
    it('should push a local commits to a remote');
  });
  describe('GET /git/:repo/tree/<path>', function () {
    it('should show contents of a given file/dir');
  });
  describe('POST /git/:repo/tree/<path>', function () {
    it('should set contents of a given file in a repo');
  });
  describe('DELETE /git/:repo/tree/<path>', function () {
    it('should delete a given file from a repo');
  });
});
