var Base = requireBaseModule();
var tree = require('ascii-tree');
var SSH2Shell = require('ssh2shell');

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

    var normaliseKey = (key) => {
        var data = key.replace(/`/g, '')
            .trim().split('\n');
        data.pop();
        data.push('-----END RSA PRIVATE KEY-----');
        return data.join('\n');
    };

    var currentDeploys = [];

    var generateTree = (arr) => {
        var groups = {
            name: 'Projects',
            children: []
        };
        var generateRawTree = (child, level) => {
            level = level || 1;
            var input = '';
            if (child.name !== '/') {
                input = '#'.repeat(level) + child.name;
            }
            if (!child.children.length) {
                input += ` (${child.path})`;
            }
            input += "\n" + child.children.map(c => generateRawTree(c, level + 1)).join('');
            return input + "\n";
        };
        arr.sort()
            .forEach(p => {
                var components = p.split('/');
                var target = groups;
                for (var i = 0; i < components.length; i++) {
                    var name = components[i];
                    var t = target.children.find(x => x.name === name);
                    if (t) {
                        target = t;
                        continue;
                    }

                    var newItem = {
                        name,
                        children: [],
                        parent: target,
                        path: (() => {
                            var parent = target;
                            var tree = [];
                            while (parent) {
                                if (parent.name !== 'Projects') {
                                    tree.push(parent.name);
                                }
                                parent = parent.parent;
                            }
                            return (tree.length ? tree.reverse().join('/') + '/' : '') + name;
                        })()
                    };
                    target.children.push(newItem);
                    target = newItem;
                }
            });
        return generateRawTree(groups);
    }

    this.respond(/((?:configure suas chaves)|(?:deploy\.config\.keys))$/i, (response) => {
        response.sendTyping();
        response.getUser().then(u => {
            if (u.isRoot()) {
                var public,
                    private;
                response.ask('Qual a chave *pública*? :old_key: ', this.Context.REGEX, /([\s\S]*)/m)
                    .then((answer) => {
                        public = normaliseKey(answer.match[1] || '');
                        if (!public.length) {
                            return answer.reply('Preciso que me informe a chave pública :disappointed:');
                        }
                        answer.user.ask('Ok, e qual a chave *privada*? :old_key: ', this.Context.REGEX, /([\s\S]*)/m)
                            .then((answer) => {
                                private = normaliseKey(answer.match[1] || '');
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
                response.reply('>```' + tree.generate(generateTree(arr.map(p => p.name))) + '```');
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
        if (response.channel.name && response.channel.name == 'mission-control') {
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
                    var project = arr[0];
                    if (currentDeploys.indexOf(project.name) != -1) {
                        return response.reply('Ué! Já estou fazendo este deploy, checa lá no nosso canal! :skull:');
                    }
                    Keys
                        .find({}, 'private', ((err, result) => {
                            if (result.length) {
                                var key = result[0];
                                var STDOUT = '';
                                var host = {
                                    server: {
                                        host: project.host,
                                        port: 22,
                                        userName: project.user,
                                        privateKey: key.private
                                    },
                                    idleTimeOut: 5 * 60000,
                                    commands: project.commands.split('\n'),
                                    onCommandComplete: (command, output) => {
                                        response.reply(`\`${command}\` :hourglass: \`\`\`${output}\`\`\``);
                                    },
                                    onCommandTimeout: (command, response, stream, connection) => {
                                        response.reply(`IH! \`${command}\` demorou demais pra executar (só pude esperar 5 minutinhos, o metrô estava chegando) :disappointed: \`\`\`${response}\`\`\``);
                                        currentDeploys.remove(project.name);
                                    },
                                    onEnd: (sessionText) => {
                                        response.reply('Pronto! Já pode avisar a galera de QA :ok_hand:');
                                        currentDeploys.remove(project.name);
                                    },
                                    onError: (err, type) => {
                                        response.reply(`Eita! :disappointed: \`\`\`${err}\`\`\``);
                                        currentDeploys.remove(project.name);
                                    }
                                }
                                response.reply('Vamos lá! :knife: :skull:');
                                currentDeploys.push(project.name);
                                var client = new SSH2Shell(host);
                                client.connect();
                            } else {
                                response.reply('Não tenho nenhuma chave privada configurada :(');
                            }
                        }))
                })
                .catch(e => console.error(e));
        } else {
            response.reply('Esse comando precisa ser lá no Mission Control :heart:');
        }
    });

};

module.exports = Base.setup(GiskardDeploy);
