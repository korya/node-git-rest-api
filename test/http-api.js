
describe('http api', function () {
  describe('GET /git/', function () {
    it('should return list of repositories');
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
