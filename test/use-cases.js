var request = require('supertest'),
    should = require('should'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    fs = require('fs'),
    api = require('../rest-api'),
    uploadFile = require('./uploadFile')
    ;

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
        res.body.should.eql({ repo: "test-clone" });
        done();
      });
  });

  it('should be possible to make a shallow clone of a repo', function (done) {
    agent
      .post('/clone')
      .send({ remote: "./test", repo: "test-clone-shallow", depth: 1 })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) throw err;
        should.not.exist(res.body.error);
        res.body.should.eql({ repo: "test-clone-shallow" });
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
        res.body.should.eql(["test", "test-clone", "test-clone-shallow"]);
        done();
      });
  });

  it('should remove existing local repo', function (done) {
    agent
      .del('/repo/test-clone')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	res.body.should.eql({});
	done();
      });
  });

  it('should return the remaining local repo', function (done) {
    agent
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) throw err;
        res.body.should.eql(["test","test-clone-shallow"]);
        done();
      });
  });

  /**
   * Working on "test" repo
   */

  var initCommit;

  it('should config a user name in a new repo', function (done) {
    agent
      .post('/repo/test/config')
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

  it('should config a user name with spaces in a new repo', function (done) {
    agent
      .post('/repo/test/config')
      .send({ name: "user.name", value: "Vava The Great" })
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
      .post('/repo/test/config')
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

  /* git commit -m 'empty commit' */
  it('should not be possible to commit when nothing is staged', function (done) {
    agent
      .post('/repo/test/commit')
      .send({ message: 'empty commit' })
      .expect('Content-Type', /json/)
      .expect(400)
      .end(function (err, res) {
	if (err) throw err;
	res.body.error.should.not.equal('');
	done();
      });
  });

  /* git commit -m 'initial commit' --allow-empty */
  it('should allow empty commit when explicitly specified', function (done) {
    var message = 'initial commit';
    agent
      .post('/repo/test/commit')
      .send({ message: message, 'allow-empty': true })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.branch.should.equal('master');
	res.body.sha1.should.not.equal('');
	res.body.title.should.equal(message);
	initCommit = res.body.sha1;
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
  
  it('should be possible to read an existing file', function (done) {
    agent
      .get('/repo/test/tree/a.txt')
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.text.should.equal('A');
	done();
      });
  });

  it('should return error when committing with no message', function (done) {
    agent
      .post('/repo/test/commit')
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
      .post('/repo/test/commit')
      .send({ message: "" })
      .expect('Content-Type', /json/)
      .expect(400)
      .end(function (err, res) {
	if (err) throw err;
	res.body.error.should.not.equal('');
	done();
      });
  });

  var commitA;
  /* git commit -m 'A' */
  it('should be possible to commit staged changes', function (done) {
    agent
      .post('/repo/test/commit')
      .send({ message: "A" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	commitA = res.body.sha1;
	done();
      });
  });

   it('should be possible to ls-tree on committed file', function (done) {
     agent
       .get('/repo/test/ls-tree/a.txt')
       .expect('Content-Type', /json/)
       .expect(200)
       .end(function (err, res) {
         if (err) throw err;
         should.not.exist(res.body.error);
         res.body.length.should.equal(1);
         res.body[0].name.should.equal("a.txt");
         res.body[0].type.should.equal("blob");
         done();
       });
   });

   it('should be possible to ls-tree on non-existing file', function (done) {
     agent
       .get('/repo/test/ls-tree/inexistant.txt')
       .expect('Content-Type', /json/)
       .expect(200)
       .end(function (err, res) {
         if (err) throw err;
         should.not.exist(res.body.error);
         res.body.length.should.equal(0);
         done();
       });
   });

  it('should return a correct branch list', function (done) {
    agent
      .get('/repo/test/branch')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql([
	  { name: 'master', current: true },
	]);
	done();
      });
  });

  /* git branch 'test-br' */
  it('should be possible to create a new branch', function (done) {
    agent
      .post('/repo/test/branch')
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
      .post('/repo/test/checkout')
      .send({ branch: "test-br" })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	done();
      });
  });

  it('should return an updated branch list', function (done) {
    agent
      .get('/repo/test/branch')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql([
	  { name: 'master' },
	  { name: 'test-br', current: true },
	]);
	done();
      });
  });

  /* echo AA > a.txt && git add a.txt */
  it('should be possible to write to an existing file', function (done) {
    uploadFile(agent, 'test', 'a.txt', 'AA')
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	done();
      });
  });
  
  /* echo BB > b.txt && git add b.txt */
  it('should be possible to write to an existing file', function (done) {
    uploadFile(agent, 'test', 'b.txt', 'BB')
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	done();
      });
  });

  var commitB;
  /* git commit -m 'B' */
  it('should be possible to commit staged changes', function (done) {
    var message = 'wrote: AA -> a.txt, BB -> b.txt';

    agent
      .post('/repo/test/commit')
      .send({ message: message })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.branch.should.equal('test-br');
	res.body.sha1.should.not.equal('');
	res.body.title.should.equal(message);
	commitB = res.body.sha1;
	done();
      });
  });

  it('should be possible to read new file contents', function (done) {
    agent
      .get('/repo/test/tree/b.txt')
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.text.should.equal('BB');
	done();
      });
  });

  it('should be possible to read changed file contents', function (done) {
    agent
      .get('/repo/test/tree/a.txt')
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.text.should.equal('AA');
	done();
      });
  });

  it('should be possible to read changed file contents at HEAD', function (done) {
    agent
      .get('/repo/test/show/a.txt?rev="HEAD"')
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.text.should.equal('AA');
	done();
      });
  });

  it('should be possible to read changed file contents at HEAD~', function (done) {
    agent
      .get('/repo/test/show/a.txt?rev="HEAD~"')
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.text.should.equal('A');
	done();
      });
  });

  it('should be possible to read changed file contents at master', function (done) {
    agent
      .get('/repo/test/show/a.txt?rev="master"')
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.text.should.equal('A');
	done();
      });
  });

  it('should be possible to read log', function (done) {
    agent
      .get('/repo/test/log')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	res.body.should.be.an.instanceOf(Array);
	done();
      });
  });

  it('should be possible to read log of last commit alone', function (done) {
    agent
      .get('/repo/test/log?revRange=-1')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) throw err;
        res.body.should.be.an.instanceOf(Array);
        res.body.length.should.equal(1);
        done();
      });
  });

  it('should be possible to see commit A details', function (done) {
    agent
      .get('/repo/test/commit/' + commitA)
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	res.body.sha1.should.startWith(commitA);
	res.body.files.should.eql([
	  { path: 'a.txt', action: 'added' },
	]);
	res.body.parents[0].should.startWith(initCommit);
	res.body.message.should.eql('A');
	done();
      });
  });

  it('should be possible to see commit B details', function (done) {
    agent
      .get('/repo/test/commit/' + commitB)
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	res.body.sha1.should.startWith(commitB);
	res.body.files.should.eql([
	  { path: 'a.txt', action: 'changed' },
	  { path: 'b.txt', action: 'added' },
	]);
	res.body.parents.should.be.an.Array.and.have.lengthOf(1);
	res.body.parents[0].should.startWith(commitA);
	res.body.message.should.eql('wrote: AA -> a.txt, BB -> b.txt');
	done();
      });
  });

  /* echo AAA > a.txt && git add a.txt */
  it('should be possible to write to an existing file', function (done) {
    uploadFile(agent, 'test', 'a.txt', 'AAA')
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	done();
      });
  });
  
  /* git rm b.txt */
  it('should be possible to remove an existing file', function (done) {
    agent
      .del('/repo/test/tree/b.txt')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.should.eql({});
	done();
      });
  });

  var commitC;
  /* git commit -m 'B' */
  it('should be possible to commit staged changes', function (done) {
    var message = 'AAA -> a.txt, remove b.txt';

    agent
      .post('/repo/test/commit')
      .send({ message: message })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	should.not.exist(res.body.error);
	res.body.branch.should.equal('test-br');
	res.body.sha1.should.not.equal('');
	res.body.title.should.equal(message);
	commitC = res.body.sha1;
	done();
      });
  });

  it('should be possible to see commit C details', function (done) {
    agent
      .get('/repo/test/commit/' + commitC)
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
	if (err) throw err;
	res.body.sha1.should.startWith(commitC);
	res.body.files.should.eql([
	  { path: 'a.txt', action: 'changed' },
	  { path: 'b.txt', action: 'removed' },
	]);
	res.body.parents.should.be.an.Array.and.have.lengthOf(1);
	res.body.parents[0].should.startWith(commitB);
	res.body.message.should.eql('AAA -> a.txt, remove b.txt');
	done();
      });
  });

  it('should be possible to see diff of a.txt in HEAD~3 and HEAD~2', function (done) {
    agent
      .get('/repo/test/diff/a.txt?commit1=' + 'HEAD~3' + '&commit2=' + 'HEAD~2')
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

  it('should be possible to see diff of a.txt in commitA and commitC', function (done) {
    agent
      .get('/repo/test/diff/a.txt?commit1=' + commitA + '&commit2=' + commitC)
      .expect(200)
      .end(function (err, res) {
        if (err) throw err;
        res.text.should.equal(
        'diff --git a/a.txt b/a.txt\n'+
        'index 8c7e5a6..43d88b6 100644\n'+
        '--- a/a.txt\n'+
        '+++ b/a.txt\n'+
        '@@ -1 +1 @@\n'+
        '-A\n'+
        '\\ No newline at end of file\n'+
        '+AAA\n'+
        '\\ No newline at end of file\n');
        done();
      });
  });

  it('should be possible to see diff of root in commitB and commitC', function (done) {
    agent
      .get('/repo/test/diff/?commit1=' + commitB + '&commit2=' + commitC)
      .expect(200)
      .end(function (err, res) {
        if (err) throw err;
        res.text.should.equal(
        'diff --git a/a.txt b/a.txt\n'+
        'index 6c376d9..43d88b6 100644\n'+
        '--- a/a.txt\n'+
        '+++ b/a.txt\n'+
        '@@ -1 +1 @@\n'+
        '-AA\n'+
        '\\ No newline at end of file\n'+
        '+AAA\n'+
        '\\ No newline at end of file\n'+
        'diff --git a/b.txt b/b.txt\n'+
        'deleted file mode 100644\n'+
        'index 080f8fb..0000000\n'+
        '--- a/b.txt\n'+
        '+++ /dev/null\n'+
        '@@ -1 +0,0 @@\n'+
        '-BB\n'+
        '\\ No newline at end of file\n');
        done();
      });
  });

  it('should be possible to see diff of a.txt in commitB (implicitly vs HEAD)', function (done) {
    agent
      .get('/repo/test/diff/b.txt?commit1=' + commitB)
      .expect(200)
      .end(function (err, res) {
        if (err) throw err;
        res.text.should.equal(
        'diff --git a/b.txt b/b.txt\n'+
        'deleted file mode 100644\n'+
        'index 080f8fb..0000000\n'+
        '--- a/b.txt\n'+
        '+++ /dev/null\n'+
        '@@ -1 +0,0 @@\n'+
        '-BB\n'+
        '\\ No newline at end of file\n');
        done();
      });
  });

  it('should urldecode file names with spaces', function (done) {
    var fn = 'folder name/a file with spaces.txt';
    uploadFile(agent, 'test', fn, 'Content of file')
      .expect(200)
      .end(function (err, res) {
        agent
          .post('/repo/test/commit')
          .send({ message: 'commit file with spaces in name' })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function (err, res) {

            agent
              .get('/repo/test/ls-tree/' + fn)
              .expect(200)
              .end(function (err, res) {
                if (err) throw err;
                should.not.exist(res.body.error);
                res.body.length.should.equal(1);
                res.body[0].name.should.equal(path.basename(fn));

                agent
                  .get('/repo/test/tree/' + fn)
                  .expect(200)
                  .end(function (err, res) {
                    if (err) throw err;
                    should.not.exist(res.body.error);
                    res.text.should.equal('Content of file');
                    done();
                  });
              });
          });
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
