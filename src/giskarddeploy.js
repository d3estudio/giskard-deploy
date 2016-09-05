var Base = requireBaseModule();

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

    var public,
        private;

    this.respond(/((?:configure suas chaves)|(?:deploy\.config\.keys))$/i, (response) => {
        response.sendTyping();
        response.getUser().then(u => {
            if (u.isRoot()) {
                response.user.ask('Qual a chave *publica*? :old_key: ', this.Context.REGEX, /(.*)$/i)
                    .then((answer) => {
                        public = (answer.match[1] || '').replace(/`/g, '').trim();
                        if (!public.length) {
                            return answer.reply('Preciso que me informe a chave pública :disappointed:');
                        }
                        answer.user.ask('Ok, e qual a chave *privada*? :old_key: ', this.Context.REGEX, /(.*)$/i)
                            .then((answer) => {
                                private = (answer.match[1] || '').replace(/`/g, '').trim();
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
        response.getUser().then(u => {
            if (u.isRoot()) {
                Keys.find({}, 'public', (err, result) => {
                    if (result.length) {
                        response.reply(`Esta: \n\`\`\`${result[0].public}\`\`\``);
                    } else {
                        response.reply(`Não tenho nenhuma configurada ainda :(`);
                    }
                });
            } else {
                response.reply('Você não pode falar assim comigo :(');
            }
        });
    });

    var name,
        user,
        host,
        commands;

    this.respond(/(?:(?:configure (?:um\s)?deploy(?:\spara)?(\s[^\s]+)?)|(?:deploy\.new(?:\s([^\s]+))?))$/i, (response) => {
        response.sendTyping();
        response.getUser().then(u => {
            if (u.isRoot()) {
                return new Promise((resolve, reject) => {
                        console.log(response.match[0].indexOf('deploy.new'));
                        if (response.match[0].indexOf('deploy.new') != -1) {
                            if (response.match[2]) {
                                name = (response.match[2] || '').trim();
                                return resolve();
                            } else {
                                response.user.ask('Qual o nome do projeto? :secret:', this.Context.REGEX, /(.*)$/i)
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
                        console.log(result);
                        if (result) {
                            response.reply(`> :warning: Este projeto já existe e será sobrescrito caso continue :warning:`);
                        }
                        return response.user.ask('Qual usuário devo usar para autenticar-me no servidor remoto? :secret:', this.Context.REGEX, /(.*)$/i)
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
                        return response.user.ask('Qual o endereço do servidor remoto? :secret:', this.Context.REGEX, /(.*)$/i)
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
                        return response.user.ask('Forneça quais comandos devo utilizar para realizar o deploy. Utilize três backticks caso seja mais complicado do que uma linha :smirk:', this.Context.REGEX, /(.*)$/i)
                            .then((answer) => {
                                commands = (answer.match[1] || '').trim();
                                if (commands.length) {
                                    Keys.find({}, 'public', (err, result) => {
                                        if (result.length) {
                                            answer.reply(`Pronto! Não esqueça de adicionar a seguinte chave ao \`authorized_keys\`\n\`\`\`${result[0].public}\`\`\``)
                                        } else {
                                            answer.reply(`Pronto! Não esqueça de me dar uma chave privada para trabalhar nesse server com o comando \`configure suas chaves\` ou \`deploy.configure\` \`\`\``)
                                        }
                                        Projects.update({}, {
                                            name, user, host, commands
                                        }, {
                                            upsert: true
                                        }).then((err, result) => {
                                            console.log(err, result);
                                        })
                                    });
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
            } else {
                response.reply('Você não pode falar assim comigo :(');
            }
        });
    });
};

module.exports = Base.setup(GiskardDeploy);
