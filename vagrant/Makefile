DEFAULT_BOX='precise32'
DEFAULT_BOX_URL='http://files.vagrantup.com/precise32.box'
BOX_HTTP_PORT=8080

all: vagrant-up
clean: vagrant-destroy
provision: vagrant-provision

vagrant-up: Vagrantfile
	vagrant up

vagrant-destroy:
	vagrant destroy -f
	rm Vagrantfile

vagrant-provision:
	vagrant provision

Vagrantfile: vagrant-box
	echo 'Vagrant::Config.run do |config|\n' \
	     '  config.vm.box = "$(DEFAULT_BOX)"\n' \
	     '  config.vm.forward_port 80, $(BOX_HTTP_PORT)\n' \
	     '  config.vm.provision :puppet do |puppet|\n' \
	     '    puppet.options = "--verbose --debug"\n' \
	     '  end\n' \
	     'end' > Vagrantfile

vagrant-box:
#          vagrant box add $(DEFAULT_BOX) $(DEFAULT_BOX_URL)

.PHONY: vagrant-box vagrant-prepare
