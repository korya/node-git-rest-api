Exec {
  path => "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  #user => "vagrant",
  logoutput => "on_failure",
  loglevel => "debug",
}

exec { "apt-get update":
  command => "true",
}

package { "deps":
  name => ["gcc", "g++", "make", "git"],
  ensure  => present,
  require => Exec["apt-get update"],
}

exec { "node-fetch":
  command => "git clone https://github.com/joyent/node node",
  creates => "/home/vagrant/node/configure",
  timeout => 600, # 10 minutes
  cwd => "/home/vagrant",
  require => Package["deps"],
}

exec { "node-config":
  command => "/home/vagrant/node/configure",
  creates => "/home/vagrant/node/config.mk",
  cwd => "/home/vagrant/node",
  require => Exec["node-fetch"],
}

exec { "node-build":
  command => "make",
  timeout => 3200, # 1 hour
  creates => "/home/vagrant/node/out/Release/node",
  cwd => "/home/vagrant/node",
  require => Exec["node-config"],
}

exec { "node-install":
  command => "sudo make install",
  creates => ["/usr/local/bin/node", "/usr/local/bin/npm"],
  cwd => "/home/vagrant/node",
  require => Exec["node-build"],
}

exec { "project-fetch":
  command => "git clone https://github.com/korya/node-git-rest-api project",
  creates => "/home/vagrant/project",
  cwd => "/home/vagrant",
  require => Package["deps"],
}

exec { "project-install":
  command => "npm install",
  cwd => "/home/vagrant/project",
  require => [Exec["project-fetch"], Exec["node-install"]],
}

exec { "project-test":
  command => "npm test",
  cwd => "/home/vagrant/project",
  require => [Exec["project-install"], Exec["node-install"]],
}
