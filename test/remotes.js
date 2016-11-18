var request = require('supertest'),
    should = require('should'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    fs = require('fs'),
    api = require('../rest-api');

describe('remote:', function () {
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

  it('should not be possible to fetch remotes of non-existing repo', function (done) {
    agent
      .post('/repo/BAD-BRANCH/remote')
      .expect('Content-Type', /json/)
      .expect(400)
      .end(function (err, res) {
	if (err) throw err;
	res.body.error.should.not.equal('');
	done();
      });
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

  it('should return empty list for the just created repo', function (done) {
    agent
      .get('/repo/test/remote')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.be.instanceof(Array).and.have.lengthOf(0);
	done();
      });
  });

  it('should be possible to clone a repo', function (done) {
    agent
      .post('/clone')
      .send({ remote: "./test", repo: "test-clone" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({ repo: "test-clone" });
	done();
      });
  });

  it('should return origin remote for the just cloned repo', function (done) {
    agent
      .get('/repo/test-clone/remote')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.be.instanceof(Array).and.have.lengthOf(1);
	res.body[0].name.should.be.exactly('origin');
	res.body[0].url.should.endWith('test');
	done();
      });
  });

  it('should be possible to add "test" remote', function (done) {
    agent
      .post('/repo/test/remote')
      .send({ name: 'test', url: 'http://test/test.git' })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({});
	done();
      });
  });

  it('should be possible to add "qwe" remote', function (done) {
    agent
      .post('/repo/test/remote')
      .send({ name: 'qwe', url: 'https://qwe.qwe/' })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({});
	done();
      });
  });

  it('should return the added remotes', function (done) {
    agent
      .get('/repo/test/remote')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.be.instanceof(Array).and.have.lengthOf(2);
	res.body.should.eql([
	  { name: 'qwe', url: 'https://qwe.qwe/' },
	  { name: 'test', url: 'http://test/test.git' },
	]);
	done();
      });
  });

  it('should remove a remote', function (done) {
    agent
      .del('/repo/test/remote')
      .send({ name: 'test' })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({});
	done();
      });
  });

  it('should return the remaining remotes', function (done) {
    agent
      .get('/repo/test/remote')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.be.instanceof(Array).and.have.lengthOf(1);
	res.body.should.eql([
	  { name: 'qwe', url: 'https://qwe.qwe/' },
	]);
	done();
      });
  });

  it('should be possible to clone a repo', function (done) {
    agent
      .post('/clone')
      .send({ remote: "./test", repo: "test-clone2" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({ repo: "test-clone2" });
	done();
      });
  });

  it('should config a user name in a new repo', function (done) {
    agent
      .post('/repo/test-clone2/config')
      .send({ name: "user.name", value: "Vava" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({});
	done();
      });
  });

  it('should config a email name in a new repo', function (done) {
    agent
      .post('/repo/test-clone2/config')
      .send({ name: "user.email", value: "v@va" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({});
	done();
      });
  });

  it('should return the "origin" remote of a second clone', function (done) {
    agent
      .get('/repo/test-clone2/remote')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.be.instanceof(Array).and.have.lengthOf(1);
	res.body[0].name.should.be.exactly('origin');
	res.body[0].url.should.endWith('test');
	done();
      });
  });

  it('should commit an empty one', function (done) {
    agent
      .post('/repo/test-clone2/commit')
      .send({ message: 'test clone 2 commit', 'allow-empty': true })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.branch.should.equal('master');
	res.body.sha1.should.not.equal('');
	done();
      });
  });

  it('should push commit to test', function (done) {
    agent
      .post('/repo/test-clone2/push')
      .send({ branch: 'master' })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({});
	done();
      });
  });

  it('should pull commit to test', function (done) {
    agent
      .post('/repo/test-clone2/pull')
      .send({ branch: 'master' })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) throw err;
        should.not.exist(res.body.error);
        res.body.should.eql({message:'Already up-to-date.'});
        done();
      });
  });

  it('should create branch "br"', function (done) {
    agent
      .post('/repo/test-clone2/branch')
      .send({ branch: 'br' })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.branch.should.equal('br');
	done();
      });
  });

  it('should checkout to branch "br"', function (done) {
    agent
      .post('/repo/test-clone2/checkout')
      .send({ branch: 'br' })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.branch.should.equal('br');
	done();
      });
  });

  it('should commit an empty one on branch "br"', function (done) {
    agent
      .post('/repo/test-clone2/commit')
      .send({ message: 'commit on "br"', 'allow-empty': true })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.branch.should.equal('br');
	res.body.sha1.should.not.equal('');
	done();
      });
  });

  it('should push "br" to test repo', function (done) {
    agent
      .post('/repo/test-clone2/push')
      .send({ branch: 'br' })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({});
	done();
      });
  });

  it('should push "br" to test "brabra"', function (done) {
    agent
      .post('/repo/test-clone2/push')
      .send({ branch: 'br:brabra' })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({});
	done();
      });
  });

  it('should return 3 branches', function (done) {
    agent
      .get('/repo/test/branch')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.be.instanceof(Array).and.have.lengthOf(3);
	res.body.should.eql([
	  { name: 'br' },
	  { name: 'brabra' },
	  { name: 'master', current: true } 
	]);
	done();
      });
  });
});
