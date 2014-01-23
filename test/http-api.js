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

  beforeEach(function (done) {
    mkdirp.sync(TMPDIR, 0755);

    var app = require('express')();
    api.init(app, {
      prefix: '',
      tmpDir: TMPDIR,
      installMiddleware: true,
      verbose: true,
    });
    server = require('http').createServer(app).listen(PORT);
    console.log('Listening on', PORT);
    done();
  });

  afterEach(function (done) {
    server.close();

    rimraf(TMPDIR, done);
  });

  describe('Empty repository:', function () {
    it('GET / should reply with []', function (done) {
      request(URL)
	.get('/')
	.expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.should.eql([]);
	  done();
	});
    });

    it('POST /init?{} should reply with error', function (done) {
      request(URL)
	.post('/init')
        .send({})
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('POST /init?{repo:<illegal>} should reply with error', function (done) {
      request(URL)
	.post('/init')
        .send({repo:"re/po"})
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('POST /init?{repo:<legal>} should reply with {}', function (done) {
      request(URL)
	.post('/init')
        .send({repo:"repo"})
	.expect('Content-Type', /json/)
        .expect(200)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.should.eql({repo:"repo"});
	  done();
	});
    });

    it('POST /clone?{} should reply with error', function (done) {
      request(URL)
	.post('/clone')
        .send({})
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('POST /clone?{repo:<legal>} should reply with error', function (done) {
      request(URL)
	.post('/clone')
        .send({repo:"repo"})
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('POST /clone?{remote:<illegal>} should reply with error', function (done) {
      request(URL)
	.post('/clone')
        .send({remote:"repo"})
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('POST /clone?{remote:<illegal>,repo:<legal>} should reply with error', function (done) {
      request(URL)
	.post('/clone')
        .send({remote:"repo", repo:"repo"})
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('GET /:repo/branch should reply with error', function (done) {
      request(URL)
	.get('/repo/repo/branch')
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('POST /:repo/branch should reply with error', function (done) {
      request(URL)
	.post('/repo/repo/branch')
        .send()
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('POST /:repo/checkout should reply with error', function (done) {
      request(URL)
	.post('/repo/repo/checkout')
        .send()
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('GET /:repo/show/:path should reply with error', function (done) {
      request(URL)
	.get('/repo/repo/show/path')
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('GET /:repo/ls-tree/:path should reply with error', function (done) {
      request(URL)
	.get('/repo/repo/ls-tree/path')
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('GET /:repo/commit/:commit should reply with error', function (done) {
      request(URL)
	.get('/repo/repo/commit/commit')
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('POST /:repo/commit should reply with error', function (done) {
      request(URL)
	.post('/repo/repo/commit')
        .send()
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('POST /:repo/push should reply with error', function (done) {
      request(URL)
	.post('/repo/repo/push')
        .send()
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('GET /:repo/tree/:path should reply with error', function (done) {
      request(URL)
	.get('/repo/repo/tree/path')
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('PUT /:repo/tree/:path should reply with error', function (done) {
      request(URL)
	.put('/repo/repo/tree/path')
        .send()
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });

    it('DELETE /:repo/tree/:path should reply with error', function (done) {
      request(URL)
	.del('/repo/repo/tree/path')
        .send()
	.expect('Content-Type', /json/)
        .expect(400)
        .end(function (err, res) {
	  if (err) throw err;
	  res.body.error.should.not.equal('');
	  done();
	});
    });
  });
});
