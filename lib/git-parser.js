/*
 * This code is borrowed from `ungit`
 */
// var moment = require('moment');
var path = require('path');

exports.parseGitStatus = function(text) {
  var result = {};
  var lines = text.split('\n');
  result.branch = lines[0].split(' ').pop();
  result.inited = true;
  result.files = {};
  lines.slice(1).forEach(function(line) {
    if (line == '') return;
    var status = line.slice(0, 2);
    var filename = line.slice(3).trim();
    if (filename[0] == '"' && filename[filename.length - 1] == '"')
      filename = filename.slice(1, filename.length - 1);
    var file = {};
    file.staged = status[0] == 'A' || status[0] == 'M';
    file.removed = status[0] == 'D' || status[1] == 'D';
    file.isNew = (status[0] == '?' || status[0] == 'A') && !file.removed;
    file.conflict = status[0] == 'U' || status[1] == 'U';
    result.files[filename] = file;
  });
  return result;
};

exports.parseGitDiff = function(text) {

  var lines = text.split("\n");
  var diffs = [];

  while(lines.length && lines[0]) {
    var diff = {};
    var path = /^diff\s--git\s\w\/(.+?)\s\w\/(.+)$/.exec(lines.shift());
    diff.aPath = path[1];
    diff.bPath = path[2];

    if(/^old mode/.test(lines[0])) {
      diff.aMode = /^old mode (\d+)/.exec(lines.shift());
      diff.bMode = /^new mode (\d+)/.exec(lines.shift());
    }

    if(!lines.length || /^diff --git/.test(lines[0])) {
      diffs.push(diff);
      continue;
    }

    diff.simIndex = 0;
    diff.newFile = false;
    diff.deletedFile = false;
    diff.renamedFile = false;
    var m;

    if(/^new file/.test(lines[0])) {
      diff.bMode = /^new file mode (.+)$/.exec(lines.shift())[1];
      diff.aMode = null;
      diff.newFile = true;
    } else if(/^deleted file/.test(lines[0])) {
      diff.aMode= /^deleted file mode (.+)$/.exec(lines.shift())[1];
      diff.bMode = null;
      diff.deletedFile = true;
    } else {
      m = /^similarity index (\d+)\%/.exec(lines[0]);
      if(m) {
        diff.simIndex = m[1].to_i();
        diff.renamedFile = true;
        //shift away the 2 `rename from/to ...` lines
        lines.shift();
        lines.shift();
      }
    }

    // Shift away index, ---, +++ and @@ stuff
    if (lines.shift().indexOf('index ') == 0) lines.shift();
    lines.shift();
    var diff_lines = [];
    var originalLine, newLine;
    while(lines[0] && !/^diff/.test(lines[0])) {
      var line = lines.shift();
      if (line.indexOf('@@ ') == 0) {
        var changeGroup = /@@ -(\d+)(,\d+)? [+](\d+)(,\d+)?/.exec(line);
        originalLine = changeGroup[1];
        newLine = changeGroup[3];
        diff_lines.push([null, null, line]);
      } else {
        if (line[0] == '+') {
          diff_lines.push([null, newLine++, line]);
        } else if (line[0] == '-') {
          diff_lines.push([originalLine++, null, line]);
        } else {
          diff_lines.push([originalLine++, newLine++, line]);
        }
      }
    }
    diff.lines = diff_lines;

    diffs.push(diff);
  }
  return diffs;
}

var authorRegexp = /([^<]+)<([^>]+)>/;
var gitLogHeaders = {
  'Author': function(currentCommmit, author) {
    var capture = authorRegexp.exec(author);
    if (capture) {
      currentCommmit.authorName = capture[1].trim();
      currentCommmit.authorEmail = capture[2].trim();
    } else {
      currentCommmit.authorName = author;
    }
  },
  'Commit': function(currentCommmit, author) {
    var capture = authorRegexp.exec(author);
    if (capture) {
      currentCommmit.committerName = capture[1].trim();
      currentCommmit.committerEmail = capture[2].trim();
    } else {
      currentCommmit.committerName = author;
    }
  },
  'AuthorDate': function(currentCommmit, date) {
    currentCommmit.authorDate = date;
  },
  'CommitDate': function(currentCommmit, date) {
    currentCommmit.commitDate = date;
  },
  'Reflog': function(currentCommmit, data) {
    currentCommmit.reflogName = data.substring(0, data.indexOf(' '));
    var author = data.substring(data.indexOf(' ') + 2, data.length - 1);
    var capture = authorRegexp.exec(author);
    if (capture) {
      currentCommmit.reflogAuthorName = capture[1].trim();
      currentCommmit.reflogAuthorEmail = capture[2].trim();
    } else {
      currentCommmit.reflogAuthorName = author;
    }
  },
};
exports.parseGitLog = function(data) {
  var commits = [];
  var currentCommmit;
  var parseCommitLine = function(row) {
    if (!row.trim()) return;
    currentCommmit = { refs: [] };
    var ss = row.split('(');
    var sha1s = ss[0].split(' ').slice(1).filter(function(sha1) { return sha1 && sha1.length; });
    currentCommmit.sha1 = sha1s[0];
    currentCommmit.parents = sha1s.slice(1);
    if (ss[1]) {
      var refs = ss[1].slice(0, ss[1].length - 1);
      currentCommmit.refs = refs.split(', ');
    }
    commits.push(currentCommmit);
    parser = parseHeaderLine;
  }
  var parseHeaderLine = function(row) {
    if (row.trim() == '') {
      parser = parseCommitMessage;
    } else {
      for (var key in gitLogHeaders) {
        if (row.indexOf(key + ': ') == 0) {
          gitLogHeaders[key](currentCommmit, row.slice((key + ': ').length).trim());
          return;
        }
      }
    }
  }
  var parseCommitMessage = function(row, index) {
    if (rows[index + 1] && rows[index + 1].indexOf('commit ') == 0) {
      parser = parseCommitLine;
      return;
    }
    if (currentCommmit.message) currentCommmit.message += '\n';
    else currentCommmit.message = '';
    currentCommmit.message += row.trim();
  }
  var parser = parseCommitLine;
  var rows = data.split('\n');
  rows.forEach(function(row, index) {
    parser(row, index);
  });
  commits.forEach(function(commit) { commit.message = (typeof commit.message) === 'string' ? commit.message.trim() : ''; });
  return commits;
};

exports.parseGitCommitShow = function(data) {
  var shaParser = function(commit, line) {
    if (line.indexOf('commit ') !== 0) return false;
    line = line.split('(', 1)[0].replace(/\s{2,}/g, ' ').trim();
    var shas = line.split(' ').splice(1);
    commit.sha1 = shas[0];
    commit.parents = shas.splice(1);
    return true;
  }
  var mergeParser = function(commit, line) {
    if (line.indexOf('Merge: ') !== 0) return false; // Not a merge commit
    /* We've already got the parents, just mark the commit as merge */
    commit.isMerge = true;
    return true;
  }
  var authorParser = function(commit, line) {
    if (line.indexOf('Author: ') !== 0) return false;
    commit.author = line.replace(/^Author:/, '').trim();
    return true;
  }
  var authorDateParser = function(commit, line) {
    if (line.indexOf('AuthorDate: ') !== 0) return false;
    commit.authorDate = line.replace(/^AuthorDate:/, '').trim();
    return true;
  }
  var commitParser = function(commit, line) {
    if (line.indexOf('Commit: ') !== 0) return false;
    commit.committer = line.replace(/^Commit:/, '').trim();
    return true;
  }
  var commitDateParser = function(commit, line) {
    if (line.indexOf('CommitDate: ') !== 0) return false;
    commit.commitDate = line.replace(/^CommitDate:/, '').trim();
    return true;
  }
//   var titleParser = function(commit, line) {
//     line = line.trim();
//     if (line.length == 0) return false;
//     commit.title = line;
//     return true;
//   }
  var messageParser = function(commit, line) {
    if (line.indexOf('    ') !== 0) return false;
    line = line.trim();
    if (commit.message && line) commit.message += '\n'
    commit.message += line;
    return true;
  }
  var fileListParser = function(commit, line) {
    if (line.length === 0) return false;
    if (line.indexOf('diff ') === 0) {
      commit.files.push({});
    } else if (line.indexOf('--- ') === 0 || line.indexOf('+++ ') === 0) {
      var path = line.substring(4);
      var file = commit.files[commit.files.length - 1];
      if (path === '/dev/null') {
	file.action = line.indexOf('--- ') === 0 ? 'added' : 'removed';
      } else {
	file.path = path.split('/').slice(1).join('/');
	if (!file.action) file.action = 'changed';
      }
    }
    return true;
  }
  var separatorParser = function(commit, line) {
    return (line.length == 0);
  }
  var nullParser = function(commit, line) {
    return true;
  }

  var parsers = [
    /* The order matters. */
    shaParser,
    mergeParser,
    authorParser,
    authorDateParser,
    commitParser,
    commitDateParser,
    separatorParser,
//     titleParser,
    messageParser,
    separatorParser,
    fileListParser,
    nullParser
  ];
  var commit = {
    files: [],
    message: '',
  };

  data.split('\n').forEach(function(line) {
    while (!parsers[0](commit, line)) {
      parsers.shift();
    }
  });

  return commit;
}

exports.parseGitConfig = function(text) {
  return text.split('\n').filter(function (line) {
    return line.trim().length;
  });
}

exports.parseGitConfigList = function(text) {
  var conf = {};
  text.split('\n').forEach(function(row) {
    var ss = row.split('=');
    conf[ss[0]] = ss[1];
  });
  return conf;
}

exports.parseGitBranches = function(text) {
  var branches = [];
  text.split('\n').forEach(function(row) {
    if (row.trim() == '') return;
    var branch = { name: row.slice(2) };
    if(row[0] == '*') branch.current = true;
    branches.push(branch);
  });
  return branches;
}

exports.parseGitTags = function(text) {
  return text.split('\n').filter(function(tag) {
    return tag != '';
  });
}

exports.parseGitRemotes = function(text) {
  var hash = {};
  var remotes = [];

  text.split('\n').filter(function (line) {
    return line.trim().length;
  }).forEach(function (remote) {
    var fields = remote.split(' ')[0].split('\t');
    var name = fields[0];
    var url = fields[1];

    if (hash[name]) return;
    hash[name] = {name:name, url:url};
    remotes.push(hash[name]);
  });

  return remotes;
}

exports.parseGitLsRemote = function(text) {
  return text.split('\n').filter(function(item) {
    return item && item.indexOf('From ') != 0;
  }).map(function(line) {
    var sha1 = line.slice(0, 40);
    var name = line.slice(41).trim();
    return { sha1: sha1, name: name };
  });
}

exports.parseGitStashShow = function(text) {
  var lines = text.split('\n').filter(function(item) {
    return item;
  });
  return lines.slice(0, lines.length - 1).map(function(line) {
    var split = line.indexOf('|');
    return {
      filename: line.substring(0, split).trim()
    }
  });
}

exports.parseLsTreeSimple = function(data) {
  var result = [];

  var parseLine = function(line) {
    // Format: <mode> SP <type> SP <object> TAB <file>
    var fields = line.split('\t', 1)[0].split(' ');
    var filePath = line.split('\t', 2)[1];

    obj = {};
    obj.name = path.basename(filePath);
    obj.mode = fields[0];
    obj.type = fields[1];
    obj.sha1 = fields[2];

    result.push(obj);
  }

  data.split('\n').forEach(function(line) {
    line = line.trim();
    if (line) parseLine(line);
  });

  return result;
}

exports.parseLsTree = function(filterPath) {
  var parseLine = function(index, tree, line) {
    // Format: <mode> SP <type> SP <object> TAB <file>
    var fields = line.split('\t', 1)[0].split(' ');
    var filePath = line.split('\t', 2)[1];

    obj = {};
    obj.name = path.basename(filePath);
    obj.mode = fields[0];
    obj.type = fields[1];
    obj.sha1 = fields[2];
    if (obj.type === 'tree') obj.contents = [];

    dirObj = getFileObj(index, path.dirname(filePath));
    dirObj.contents.push(obj);
    index[filePath] = obj;
  }
  var getFileObj = function(index, filePath) {
    if (!filePath) filePath = '.';
    return index[filePath];
  }
  return function(data) {
    var tree = { name: '.', type: 'tree', contents: [] };
    var index = { '.': tree };
    data.split('\n').forEach(function(line) {
      line = line.trim();
      if (line) parseLine(index, tree, line);
    });
    return getFileObj(index, filterPath);
  }
}

exports.parseCommit = function(data) {
  /* Examples:
   *   [master a081a59] A
   *   [master (root-commit) 3b8505e] init
   *
   *   1: branch name: [-_a-z0-9]*
   *   2: optional:    ([^\]]*\s)?
   *   3: commit:      [0-9a-f]{4,40}
   *   4: title:       (.*)$
   */
  var statusRe = /^\[([-_a-z0-9]*)\s([^\]]*\s)?([0-9a-f]{4,40})\] (.*)$/i;
  var lines = data.split('\n');
  var match = statusRe.exec(lines[0]);

  return {
    branch: match[1],
    sha1: match[3],
    title: match[4],
  };
}
