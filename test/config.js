var request = require('supertest'),
    should = require('should'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    fs = require('fs'),
    api = require('../rest-api');

describe('git-config:', function () {
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
      tmpDir: TMPDIR,
      installMiddleware: true,
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

  it('should be able to create a repo', function (done) {
    agent
      .post('/init')
      .send({ repo: "test", bare: true, shared: true })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({ repo: "test" });
	done();
      });
  });

  it('should return error for non-existing option', function (done) {
    agent
      .get('/repo/test/config?name=qwe.qwe')
      .expect('Content-Type', /json/)
      .expect(400)
      .end(function (err, res) {
	if (err) throw err;
//         res.body.error.should.not.equal('');
	done();
      });
  });

  it('should be possible to set an option', function (done) {
    agent
      .post('/repo/test/config')
      .send({ name: "qwe.qwe", value: "Q" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({});
	done();
      });
  });

  it('should return the value of a set option', function (done) {
    agent
      .get('/repo/test/config?name=qwe.qwe')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({ values: ["Q"] });
	done();
      });
  });

  it('should be possible to add an option', function (done) {
    agent
      .post('/repo/test/config')
      .send({ name: "qwe.qwe", value: "QQ" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({});
	done();
      });
  });

  it('should be possible to add another option', function (done) {
    agent
      .post('/repo/test/config')
      .send({ name: "qwe.qwe", value: "QQQ" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({});
	done();
      });
  });

  it('should return multiple values of an option', function (done) {
    agent
      .get('/repo/test/config?name=qwe.qwe')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({ values: ["Q", "QQ", "QQQ"] });
	done();
      });
  });

  it('should be possible to override an option', function (done) {
    agent
      .put('/repo/test/config')
      .send({ name: "qwe.qwe", value: "WWW" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({});
	done();
      });
  });

  it('should return the value of an overriden option', function (done) {
    agent
      .get('/repo/test/config?name=qwe.qwe')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({ values: ["WWW"] });
	done();
      });
  });

  it('should be possible to delete an option', function (done) {
    agent
      .del('/repo/test/config')
      .send({ name: "qwe.qwe" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({});
	done();
      });
  });

  it('should return error when reading a removed option', function (done) {
    agent
      .get('/repo/test/config?name=qwe.qwe')
      .expect('Content-Type', /json/)
      .expect(400)
      .end(function (err, res) {
	if (err) throw err;
//         res.body.error.should.not.equal('');
	done();
      });
  });


});
