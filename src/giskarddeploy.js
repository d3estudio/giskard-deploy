var Base = requireBaseModule();
var tree = require('ascii-tree');

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

    const generateTree = (arr) => {
        let groups = {
            name: 'Projects',
            children: []
        };
        const generateRawTree = (child, level) => {
            level = level || 1;
            let input = '';
            if(child.name !== '/') {
                input = '#'.repeat(level) + child.name;
            }
            if(!child.children.length) {
                input += ` (${child.path})`;
            }
            input += "\n" + child.children.map(c => generateRawTree(c, level + 1)).join('');
            return input + "\n";
        };
        arr.sort()
            .forEach(p => {
                const components = p.split('/');
                let target = groups;
                for(let i = 0; i < components.length; i++) {
                    const name = components[i];
                    const t = target.children.find(x => x.name === name);
                    if(t) {
                        target = t;
                        continue;
                    }

                    const newItem = {
                        name,
                        children: [],
                        path: (() => {
                            let parent = target;
                            let tree = [];
                            while(parent) {
                                if(parent.name !== 'Projects') {
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
        console.log(JSON.stringify(groups, null, 2));
        return generateRawTree(groups);
    }

    this.respond(/((?:configure suas chaves)|(?:deploy\.config\.keys))$/i, (response) => {
        response.sendTyping();
        response.getUser().then(u => {
            if (u.isRoot()) {
                var public,
                    private;
                response.user.ask('Qual a chave *pública*? :old_key: ', this.Context.REGEX, /(.*)$/im)
                    .then((answer) => {
                        console.log(answer);
                        public = (answer.match[1] || '').replace(/`/g, '').trim();
                        if (!public.length) {
                            return answer.reply('Preciso que me informe a chave pública :disappointed:');
                        }
                        answer.user.ask('Ok, e qual a chave *privada*? :old_key: ', this.Context.REGEX, /(.*)$/im)
                            .then((answer) => {
                                console.log(answer);
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

    this.respond(/(?:(?:configure (?:um\s)?deploy(?:\spara)?(\s[^\s]+)?)|(?:deploy\.new(?:\s([^\s]+))?))$/i, (response) => {
        var name,
            user,
            host,
            commands;
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
                                        Projects.update({name: name}, {
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

    this.respond(/(?:(?:liste (?:projetos de deploy|deploys configurados)|deploy\.list))/i, (response) => {
        response.sendTyping();
        Projects
            .find()
            .exec()
            .then(arr => {
                if(arr.length < 1) {
                    return response.reply(':hushed: Parece que não existe nenhum projeto de deploy configurado.');
                }
                response.reply('Você pediu, aqui está. Eu mesmo desenhei, espero que goste. :robin:')
                response.reply('>```' + tree.generate(generateTree(arr.map(p => p.name))) + '```');
            })
            .catch(e => console.error(e));
    });
};

module.exports = Base.setup(GiskardDeploy);
