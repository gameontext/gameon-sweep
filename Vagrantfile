# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  config.vm.box = "bento/ubuntu-16.04"
  config.vm.provider "virtualbox" do |v|
    v.memory = 3072
    v.cpus = 2
    v.name = "gameontext-sweep"
  end

  #fix 'stdin is not a tty' output.
  config.vm.provision :shell, inline: "(grep -q -E '^mesg n$' /root/.profile && sed -i 's/^mesg n$/tty -s \\&\\& mesg n/g' /root/.profile && echo 'Ignore the previous error about stdin not being a tty. Fixing it now...') || exit 0;"

  # Run as Root -- install git, ibmcloud cli, node
  config.vm.provision :shell, :inline => <<-EOT
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade

    curl -sL https://deb.nodesource.com/setup_6.x -o node_setup
    bash node_setup
    rm node_setup

    echo 'Installing Git, Curl, & Nodejs'
    apt-get install -y \
      git \
      curl \
      jq \
      nodejs  \
      zip

    if /usr/local/bin/ibmcloud > /dev/null 2>/dev/null
    then
      echo 'Updating IBM Cloud CLI'
      /usr/local/bin/ibmcloud update
    else
      echo 'Installing IBM Cloud CLI'
      curl -sL https://ibm.biz/idt-installer | bash
    fi
  EOT

  # Run as vagrant user (not yet in docker group): ibmcloud plugins, profile script
  config.vm.provision :shell, privileged: false, :inline => <<-EOT
    # don't put global npm modules in /usr/lib
    mkdir ~/.npm-global
    npm config set prefix '~/.npm-global'

    # Indicate this is a vagrant VM
    echo 'export USE_VAGRANT=true' | tee -a /home/vagrant/.profile

    # By default this working directory is mapped to /vagrant,
    # automatically change directories on login
    echo 'cd /vagrant' | tee -a /home/vagrant/.profile
    echo '/vagrant/bin/wsk-setup.sh' | tee -a /home/vagrant/.profile
    echo 'export PATH=~/.npm-global/bin:/vagrant/bin:$PATH' | tee -a /home/vagrant/.bashrc

    cd /vagrant
  EOT

  # Run as vagrant user: Always start things
  config.vm.provision :shell, privileged: false, run: "always", :inline => <<-EOT

    bin/update-plugins.sh

    echo 'To work on the sweep :'
    echo '> vagrant ssh'
    echo '> '
  EOT
end
