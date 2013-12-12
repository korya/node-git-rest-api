var request = require('supertest'),
    should = require('should'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    fs = require('fs'),
    api = require('../rest-api');

describe('API:', function () {
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

  it('should reply with [] when no repos', function (done) {
    agent
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	console.log(res.headers['set-cookie']);
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
	console.log(res.body);
	res.body.should.eql(["test"]);
	done();
      });
  });

  it('should return error if trying to create esisting repo', function (done) {
    agent
      .post('/init')
      .send({ repo: "test" })
      .expect('Content-Type', /json/)
      .expect(400)
      .end(function (err, res) {
	if (err) throw err;
	res.body.error.should.not.equal('');
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
	done();
      });
  });

  it('should return two existing repos', function (done) {
    agent
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	console.log(res.body);
	res.body.should.eql(["test", "test-clone"]);
	done();
      });
  });

  function uploadFile(agent, repo, filepath, content) {
    var boundary = Math.random();

    function wrapContent(boundary, filename, content) {
      var str = '';
      str += '--' + boundary + '\r\n';
      str += 'Content-Disposition: form-data; name="file"; filename="'+filename+'"\r\n';
      str += 'Content-Type: image/png\r\n';
      str += '\r\n';
      str += content;
      str += '\r\n--' + boundary + '--';
      return str;
    }

    return agent.put('/' + repo + '/tree/' + filepath)
      .set('Content-Type', 'multipart/form-data; boundary=' + boundary)
      .send(wrapContent(boundary, path.basename(filepath), content));
  }

  /**
   * Working on "test" repo
   */

  /* echo A > a.txt && git add a.txt */
  it('should be possible to write to a file', function (done) {
    uploadFile(agent, 'test', 'a.txt', 'A')
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	done();
      });
  });
  
  it('should return error when committing with no message', function (done) {
    agent
      .post('/test/commit')
      .send()
      .expect('Content-Type', /json/)
      .expect(400)
      .end(function (err, res) {
	if (err) throw err;
	res.body.error.should.not.equal('');
	done();
      });
  });

  it('should return error when committing with empty message', function (done) {
    agent
      .post('/test/commit')
      .send({ message: "" })
      .expect('Content-Type', /json/)
      .expect(400)
      .end(function (err, res) {
	if (err) throw err;
	res.body.error.should.not.equal('');
	done();
      });
  });

  /* git commit -m 'A' */
  it('should be possible to commit staged changes', function (done) {
    agent
      .post('/test/commit')
      .send({ message: "A" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	done();
      });
  });

  /* git branch 'test-br' */
  it('should be possible to create a new branch', function (done) {
    agent
      .post('/test/branch')
      .send({ branch: "test-br" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	done();
      });
  });

  /* git checkout 'test-br' */
  it('should be possible to checkout a different branch', function (done) {
    agent
      .post('/test/checkout')
      .send({ branch: "test-br" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	done();
      });
  });

  /* echo B > a.txt && git add a.txt */
  it('should be possible to write to an existing file', function (done) {
    uploadFile(agent, 'test', 'a.txt', 'B')
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	done();
      });
  });
  
  /* git commit -m 'B' */
  it('should be possible to commit staged changes', function (done) {
    agent
      .post('/test/commit')
      .send({ message: "B" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	done();
      });
  });

  /* git commit -m 'B' */
  it('should not be possible to commit when nothing is staged', function (done) {
    agent
      .post('/test/commit')
      .send({ message: "B" })
      .expect('Content-Type', /json/)
      .expect(400)
      .end(function (err, res) {
	if (err) throw err;
	res.body.error.should.not.equal('');
	done();
      });
  });

//     it('POST /:repo/checkout should reply with error', function (done) {
//       request(URL)
//         .post('/repo/checkout')
//         .send()
//         .expect('Content-Type', /json/)
//         .expect(400)
//         .end(function (err, res) {
//           if (err) throw err;
//           res.body.error.should.not.equal('');
//           done();
//         });
//     });

//     it('GET /:repo/show/:path should reply with error', function (done) {
//       request(URL)
//         .get('/repo/show/path')
//         .expect('Content-Type', /json/)
//         .expect(400)
//         .end(function (err, res) {
//           if (err) throw err;
//           res.body.error.should.not.equal('');
//           done();
//         });
//     });

//     it('GET /:repo/ls-tree/:path should reply with error', function (done) {
//       request(URL)
//         .get('/repo/ls-tree/path')
//         .expect('Content-Type', /json/)
//         .expect(400)
//         .end(function (err, res) {
//           if (err) throw err;
//           res.body.error.should.not.equal('');
//           done();
//         });
//     });

//     it('GET /:repo/commit/:commit should reply with error', function (done) {
//       request(URL)
//         .get('/repo/commit/commit')
//         .expect('Content-Type', /json/)
//         .expect(400)
//         .end(function (err, res) {
//           if (err) throw err;
//           res.body.error.should.not.equal('');
//           done();
//         });
//     });

//     it('POST /:repo/commit should reply with error', function (done) {
//       request(URL)
//         .post('/repo/commit')
//         .send()
//         .expect('Content-Type', /json/)
//         .expect(400)
//         .end(function (err, res) {
//           if (err) throw err;
//           res.body.error.should.not.equal('');
//           done();
//         });
//     });

//     it('POST /:repo/push should reply with error', function (done) {
//       request(URL)
//         .post('/repo/push')
//         .send()
//         .expect('Content-Type', /json/)
//         .expect(400)
//         .end(function (err, res) {
//           if (err) throw err;
//           res.body.error.should.not.equal('');
//           done();
//         });
//     });

//     it('GET /:repo/tree/:path should reply with error', function (done) {
//       request(URL)
//         .get('/repo/tree/path')
//         .expect('Content-Type', /json/)
//         .expect(400)
//         .end(function (err, res) {
//           if (err) throw err;
//           res.body.error.should.not.equal('');
//           done();
//         });
//     });

//     it('PUT /:repo/tree/:path should reply with error', function (done) {
//       request(URL)
//         .put('/repo/tree/path')
//         .send()
//         .expect('Content-Type', /json/)
//         .expect(400)
//         .end(function (err, res) {
//           if (err) throw err;
//           res.body.error.should.not.equal('');
//           done();
//         });
//     });

//     it('DELETE /:repo/tree/:path should reply with error', function (done) {
//       request(URL)
//         .del('/repo/tree/path')
//         .send()
//         .expect('Content-Type', /json/)
//         .expect(400)
//         .end(function (err, res) {
//           if (err) throw err;
//           res.body.error.should.not.equal('');
//           done();
//         });
//   });
});
