// copied from use-cases
// Difference is the workDir passed to api.init call
// This makes a common workDir for all sessions/cookies

var request = require('supertest'),
    should = require('should'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    fs = require('fs'),
    api = require('../rest-api');

describe('use case:', function () {
  var TMPDIR = './tmp-test-git';
  var PORT = 9854;
  var URL = 'http://localhost:' + PORT;
  var server;
  var agent;

  before(function (done) {
    mkdirp.sync(TMPDIR, 0755);

    var app = require('express')();
    api.init(app, {
      prefix: '',
      workDir: TMPDIR,
      installMiddleware: true,
      verbose: true,
    });
    server = require('http').createServer(app).listen(PORT);
    console.log('Listening on', PORT);

    agent = request.agent(URL);
    done();
  });

  after(function (done) {
    server.close();
    rimraf(TMPDIR, done);
  });

  it('should reply with [] when no repos', function (done) {
    agent
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	res.body.should.eql([]);
	done();
      });
  });

  it('should be able to create a repo', function (done) {
    agent
      .post('/init')
      .send({ repo: "test" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({ repo: "test" });
	done();
      });
  });

  it('should return the just created repo', function (done) {
    agent
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	res.body.should.eql(["test"]);
	done();
      });
  });

  it('should still return the just created repo with a new session', function (done) {
    var agent2 = request.agent(URL);
    agent2
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) throw err;
        res.body.should.eql(["test"]);
        done();
      });
  });

});
