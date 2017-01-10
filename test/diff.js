var request = require('supertest'),
    should = require('should'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    fs = require('fs'),
    api = require('../rest-api'),
    uploadFile = require('./uploadFile')
    ;

describe('diff:', function () {
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

  /* echo A > a.txt && git add a.txt */
  it('should be possible to write to a new file', function (done) {
    uploadFile(agent, 'test', 'a.txt', 'A')
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	done();
      });
  });
  
  it('should be possible to see no diff of a.txt with cached=false', function (done) {
    agent
      .get('/repo/test/diff/a.txt?cached')
      .expect(200)
      .end(function (err, res) {
        if (err) throw err;
        res.text.should.equal('');
        done();
      });
  });

  it('should be possible to see diff of a.txt with cached=true', function (done) {
    agent
      .get('/repo/test/diff/a.txt?cached=true')
      .expect(200)
      .end(function (err, res) {
        if (err) throw err;
        res.text.should.equal(
        'diff --git a/a.txt b/a.txt\n'+
        'new file mode 100644\n'+
        'index 0000000..8c7e5a6\n'+
        '--- /dev/null\n'+
        '+++ b/a.txt\n'+
        '@@ -0,0 +1 @@\n'+
        '+A\n'+
        '\\ No newline at end of file\n');
        done();
      });
  });

});
