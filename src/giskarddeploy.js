var Base = requireBaseModule();

var SSH2Shell = require('ssh2shell'),
    treeGenerator = require('./tree-generator'),
    helpers = require('./helpers'),
    consts = require('./consts');


Array.prototype.remove = function() {
    var what, a = arguments,
        L = a.length,
        ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
};

var GiskardDeploy = function() {
    Base.call(this);

    var Keys = this.registerModel('Keys', {
        public: String,
        private: String
    });

    var Projects = this.registerModel('Projects', {
        name: String,
        user: String,
        host: String,
        commands: String
    });

    var Deploys = this.registerModel('Deploy', {
        project: String,
        starter: String,
        status: String,
        result: String,
        date: Date,
        gistUrl: String
    });

    helpers.performLogCleanup(this, Deploys)
        .then(() => helpers.performStatusNormalisation(this, Deploys));

    var currentDeploys = [];

    this.launchMessages = [
        "$, this is Romeo Two Delta Three. Launch granted, over.",
        "$, this is Control. Ground crew is secure, over.",
        "Control, this is $. Prestart complete. Powering up APU's, over.",
        "$, this is Control. APU start is go. You are on your on-board computer, over.",
        "$, this is Control. Go for main engine cut-off, over.",
        "The solid rocket boosters have ignited, and we have LIFTOFF! The $ has cleared the tower.",
        "The tower has been cleared. All engines look good. Beginning roll maneuver."
    ];
    this.orbiters = "Enterprise Columbia Challenger Discovery Atlantis Endeavour".split(' ');

    this.respond(/((?:configure suas chaves)|(?:deploy\.config\.keys))$/i, (response) => {
        response.sendTyping();
        response.getUser().then(u => {
            if (u.isRoot()) {
                var public,
                    private;
                response.ask('Qual a chave *pública*? :old_key: ', this.Context.REGEX, /([\s\S]*)/m)
                    .then((answer) => {
                        public = helpers.normaliseKey(answer.match[1] || '');
                        if (!public.length) {
                            return answer.reply('Preciso que me informe a chave pública :disappointed:');
                        }
                        answer.user.ask('Ok, e qual a chave *privada*? :old_key: ', this.Context.REGEX, /([\s\S]*)/m)
                            .then((answer) => {
                                private = helpers.normaliseKey(answer.match[1] || '', true);
                                if (!private.length) {
                                    return answer.reply('Preciso que me informe a chave privada, pode confiar em mim! :disappointed:');
                                }
                                Keys.update({}, {
                                    public, private
                                }, {
                                    upsert: true
                                })
                                    .then((result) => {
                                        return answer.reply(`Chaves gravadas com muito amor (e carinho) :ok_hand:`);
                                    });
                            })
                            .catch((answer) => {
                                response.reply('Ok, fazemos depois! :ok_hand:');
                            });
                    })
                    .catch((answer) => {
                        response.reply('Ok, fazemos depois! :ok_hand:');
                    });
            } else {
                response.reply('Você não pode falar assim comigo :(');
            }
        });
    });

    this.respond(/((?:qual sua chave p(?:u|ú)blica\??)|(?:deploy\.pubkey))$/i, (response) => {
        response.sendTyping();
        Keys.find({}, 'public', (err, result) => {
            if (result.length) {
                response.reply(`Esta: \n\`\`\`${result[0].public}\`\`\``);
            } else {
                response.reply(`Não tenho nenhuma configurada ainda :(`);
            }
        });
    });

    this.respond(/(?:(?:configure (?:um\s)?deploy(?:\spara)?(\s[^\s]+)?)|(?:deploy\.new(?:\s([^\s]+))?))$/i, (response) => {
        var name,
            user,
            host,
            commands;
        response.sendTyping();
        return new Promise((resolve, reject) => {
                if (response.match[0].indexOf('deploy.new') != -1) {
                    if (response.match[2]) {
                        name = (response.match[2] || '').trim();
                        return resolve();
                    } else {
                        response.ask('Qual o nome do projeto? :secret:', this.Context.REGEX, /(.*)$/i)
                            .then((answer) => {
                                name = (answer.match[1] || '').trim();
                                if (name.length) {
                                    return resolve();
                                } else {
                                    return reject('Preciso saber o nome do projeto :(');
                                }
                            })
                    }
                } else {
                    name = (response.match[1] || '').trim();
                    if (name.length) {
                        return resolve();
                    } else {
                        return reject('Preciso saber o nome do projeto :(');
                    }
                }
            })
            .then(() => {
                return Projects.findOne({
                    name: name
                }).exec();
            })
            .then((result) => {
                if (result) {
                    response.reply(`> :warning: Este projeto já existe e será sobrescrito caso continue :warning:`);
                }
                return response.ask('Qual usuário devo usar para autenticar-me no servidor remoto? :secret:', this.Context.REGEX, /(.*)$/i)
                    .then((answer) => {
                        user = (answer.match[1] || '').trim();
                        if (user.length) {
                            return Promise.resolve();
                        } else {
                            return Promise.reject('Preciso saber o nome do usuario :(');
                        }
                    })
            })
            .then(() => {
                return response.ask('Qual o endereço do servidor remoto? :secret:', this.Context.REGEX, /(.*)$/i)
                    .then((answer) => {
                        host = (answer.match[1] || '').trim();
                        if (host.length) {
                            return Promise.resolve();
                        } else {
                            return Promise.reject('Preciso saber o nome do usuario :(');
                        }
                    })
            })
            .then(() => {
                return response.ask('Forneça quais comandos devo utilizar para realizar o deploy. Utilize três backticks caso seja mais complicado do que uma linha :smirk:', this.Context.REGEX, /([\s\S]*)/m)
                    .then((answer) => {
                        commands = (answer.match[1] || '').replace(/`/g, '').trim();
                        if (commands.length) {
                            Projects
                                .update({
                                    name: name
                                }, {
                                    name, user, host, commands
                                }, {
                                    upsert: true
                                }).then((err, result) => {
                                    Keys.find({}, 'public', (err, result) => {
                                        if (result.length) {
                                            answer.reply(`Pronto! Não esqueça de adicionar a seguinte chave ao \`authorized_keys\`\n\`\`\`${result[0].public}\`\`\``)
                                        } else {
                                            answer.reply(`Pronto! Não esqueça de me dar uma chave privada para trabalhar nesse server com o comando \`configure suas chaves\` ou \`deploy.configure\` \`\`\``)
                                        }

                                    });
                                })
                        } else {
                            return Promise.reject('Me ensina os comandos, nunca te pedi nada :(');
                        }
                    })
            })
            .catch((err) => {
                if (!err) {
                    err = 'Fazemos depois então!';
                }
                return response.reply(`${err}`);
            })
    });

    this.respond(/(?:(?:liste (?:projetos de deploy|deploys configurados)|deploy\.list))/i, (response) => {
        response.sendTyping();
        Projects
            .find()
            .exec()
            .then(arr => {
                if (arr.length < 1) {
                    return response.reply(':hushed: Parece que não existe nenhum projeto de deploy configurado.');
                }
                response.reply('Você pediu, aqui está. Eu mesmo desenhei, espero que goste. :robin:')
                response.reply('>```' + treeGenerator(arr) + '```');
            })
            .catch(e => console.error(e));
    });

    this.respond(/(?:(?:esque(?:c|ç)a o projeto)|deploy\.forget)\s([^\s]+)/i, (response) => {
        response.sendTyping();
        var name = (response.match[1] || '').trim();
        if (name.length < 1) {
            return response.reply('Preciso saber o nome do projeto :(');
        }
        Projects
            .find({
                name: name
            })
            .exec()
            .then(arr => {
                if (arr.length < 1) {
                    return response.reply(':hushed: Parece que não existe nenhum projeto com este nome.');
                }
                arr[0].remove((err) => {
                    if (err) {
                        return response.reply('Algo deu ruim! Tenta de novo, por favor!');
                    }
                    response.reply('Removido com sucesso champs! :ok_hand:');
                });
            })
            .catch(e => console.error(e));
    });

    this.respond(/deploy\s([^\s]+)/i, (response) => {
        response.sendTyping();
        let name, deployer, project, missionChannel;
        this.searchChannel('mission-control')
            .then(m => {
                missionChannel = m;
                return response.getUser();
            })
            .then(u => {
                if(!u.is('deployer')) {
                    return Promise.reject('Receio que não posso deixar você fazer isso...');
                }

                name = (response.match[1] || '').trim();
                if (name.length < 1) {
                    return Promise.reject('Preciso saber o nome do projeto :(');
                }

                return u;
            })
            .then(u => {
                deployer = u;
                return Projects.findOne({ name }).exec();
            })
            .then(p => {
                if(!p) {
                    return Promise.reject(':hushed: Parece que não existe nenhum projeto com este nome.');
                }
                if(currentDeploys.indexOf(p.name) > -1) {
                    return Promise.reject(':clock1: Já existe um deploy desse projeto em progresso.');
                }
                project = p;
                return new Promise((resolve, reject) => {
                    Deploys.create({
                        project: p.name,
                        starter: deployer.username,
                        date: Date.now(),
                        status: consts.DEPLOY_STATUS_STARTED,
                        result: '',
                    }, (err, result) => {
                        if(err) {
                            return reject(err);
                        }
                        resolve(result);
                    });
                })
            })
            .then(deployLog => {
                return new Promise((resolve, reject) => {
                    Keys.find({}, 'private', (err, res) => {
                        if(res.length < 1) {
                            return reject('Não possuo chaves configuradas! :anguished:');
                        }

                        resolve({
                            deployLog,
                            key: res[0]
                        });
                    });
                });
            })
            .then(data => {
                var deployLog = data.deployLog,
                    key = data.key,
                    sshSettings = {
                        server: {
                            host: project.host,
                            port: 22,
                            userName: project.user,
                            privateKey: key.private
                        },
                        idleTimeOut: 2 * 60 * 1000,
                        commands: project.commands.split('\n'),
                        onCommandComplete: (command, output) => {
                            output = output || '';
                            if(deployLog.result == '') {
                                deployLog.result = output ;
                            } else {
                                deployLog.result += output;
                            }
                            deployLog.save();
                        },
                        onCommandTimeout:(command, response, stream, connection) => {
                            response.reply('Seu deploy falhou devido à um timeout.');
                            missionChannel.send('', [helpers.generateAttachment({
                                fallback: `Deploy @ ${project.name} timed-out`,
                                color: 'danger',
                                text: `Deploy \`${deployLog._id}\` @ \`${project.name}\` *timed-out*.`
                            })])
                        },
                        onEnd: (sessionText) => {
                            deployLog.status = consts.DEPLOY_STATUS_COMPLETED;
                            deployLog.save();
                            currentDeploys.remove(project.name);
                            missionChannel.send('', [helpers.generateAttachment({
                                fallback: `Deploy @ ${project.name} concluído`,
                                color: 'good',
                                text: `Deploy \`${deployLog._id}\` @ \`${project.name}\` *concluído*.`
                            })])
                        },
                        onError: (err, type) => {
                            deployLog.status = consts.DEPLOY_STATUS_FAILED;
                            deployLog.result += `\n\n--- Giskard Internal Error ---\n${err.message}\n${err.stack}`;
                            deployLog.save();
                            missionChannel.send('', [helpers.generateAttachment({
                                fallback: `Deploy @ ${project.name} falhou`,
                                color: 'danger',
                                text: `Deploy \`${deployLog._id}\` @ \`${project.name}\` *falhou*.`
                            })])
                            currentDeploys.remove(project.name);
                        }
                    };
                    missionChannel.send('', [helpers.generateAttachment({
                        fallback: `Deploy @ ${project.name} iniciado por ${deployer.username}`,
                        color: 'warning',
                        text: `Deploy \`${deployLog._id}\` @ \`${project.name}\` *iniciado* por @${deployer.username}.`
                    })])
                    .catch(e => this.logger.error(e));

                    var orbiter = this.random(this.orbiters),
                        message = this.random(this.launchMessages);
                    response.reply(message.replace(/\$/g, orbiter) + ' :rocket:');

                    currentDeploys.push(project.name);
                    var client = new SSH2Shell(sshSettings);
                    client.connect();
            })
            .catch(ex => {
                if(typeof ex === 'string') {
                    response.reply(ex);
                } else {
                    this.logger.error(ex);
                }
            });
    });

    this.respond(/(?:(?:mostre os )?(?:(?:ú|u)ltimos )?deploys em|deploy.history)\s([^\s]+)/i, (response) => {
        response.sendTyping();
        var projName = response.match[1]
        Projects.findOne({ name: projName })
            .then(p => {
                if(!p) {
                    return Promise.reject(`Não conheço nenhum projeto chamado \`${projName}\`...`);
                }
                return p;
            })
            .then(p => {
                return Deploys.find({ project: projName })
                    .sort({'date': -1})
                    .limit(10)
                    .exec()
                    .then(deploys => {
                        if(deploys.length < 1) {
                            return Promise.reject(`Ainda não houve nenhum deploy em \`${projName}\``);
                        }

                        var answer;

                        if(deploys.length == 1) {
                            answer = `Ok, aqui está o último (e de alguma forma único) deploy em \`${projName}\``;
                        } else {
                            answer = `Ok, aqui estão os últimos ${deploys.length} deploys em \`${projName}\``;
                        }

                        response.reply(answer, deploys.map(helpers.generateDeploySummary));
                    });
            })
            .catch(ex => {
                if(typeof ex === 'string') {
                    response.reply(ex);
                }
                this.logger.error(ex);
            });
    });

    this.respond(/(?:mostre (?:(?:o\s)?resultado do|o)?\sdeploy|deploy.show)\s`?([a-fA-F0-9]+)`?$/i, (response) => {
        response.sendTyping();
        var did = response.match[1];
        Deploys.findById(did)
            .exec()
            .then(m => {
                if(!m) {
                    return Promise.reject(`Não conheço nenhum deploy com id \`${did}\`. :thinking_face:`);
                }
                helpers.generateDeployResult(m)
                    .then(atts => {
                        response.reply('Ok, aqui vai:', [atts]);
                    })
                    .catch(ex => {
                        this.logger.error(ex);
                    });
            })
            .catch(ex => {
                if(typeof ex === 'string') {
                    return response.reply(ex);
                }
                this.logger.error(ex)
            });
    });
};

module.exports = Base.setup(GiskardDeploy);
