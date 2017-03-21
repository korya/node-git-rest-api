var path = require('path');

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

  return agent.put('/repo/' + repo + '/tree/' + filepath)
    .set('Content-Type', 'multipart/form-data; boundary=' + boundary)
    .send(wrapContent(boundary, path.basename(filepath), content));
}

exports = module.exports = uploadFile;
