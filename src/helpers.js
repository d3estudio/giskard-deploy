var timeago = require('timeago.js'),
    consts = require('./consts'),
    github = require('octonode');

var timeagoPtBRLocale = [
  ['há pouco', 'em instantes'],
  ['há %s segundos', 'em %s segundos'],
  ['há um minuto', 'em um minuto'],
  ['há %s minutos', 'em %s minutos'],
  ['há uma hora', 'em uma hora'],
  ['há %s horas', 'em %s horas'],
  ['há um dia', 'em um dia'],
  ['há %s dias', 'em %s dias'],
  ['há uma semana', 'em uma semana'],
  ['há %s semanas', 'em %s semanas'],
  ['há um mês', 'em um mês'],
  ['há %s meses', 'em %s meses'],
  ['há um ano', 'em um ano'],
  ['há %s anos', 'em %s anos']
];

module.exports = {
    generateAttachment: (data) => Object.assign(data, { mrkdwn_in: ["text"] }),
    generateDeploySummary: (d) => {
        var color = 'danger',
            result = 'falhou';
        if(d.status === consts.DEPLOY_STATUS_STARTED) {
            color = 'warning';
            result = 'em progresso';
        } else if(d.status === consts.DEPLOY_STATUS_COMPLETED) {
            color = 'good';
            result = 'concluído';
        } else if(d.status == consts.DEPLOY_STATUS_ABORTED) {
            result = 'abortado';
        } else if(d.status == consts.DEPLOY_STATUS_UNKNOWN) {
            result = 'perdido';
            color = 'no_color';
        }

        var tag = timeago();
        tag.register('pt_BR', timeagoPtBRLocale);

        return {
            color,
            text: `Deploy \`${d._id}\` iniciado por @${d.starter} *${result}* ${tag.format(d.date.getTime(), 'pt_BR')}`,
            mrkdwn_in: ['text']
        };
    },
    normaliseKey: (key, isPrivate) => {
        var data = key.replace(/`/g, '').trim();
        if(isPrivate) {
            data = data.split('\n');
            data.pop();
            data.push('-----END RSA PRIVATE KEY-----');
            data = data.join('\n');
        }

        return data;
    },
    performStatusNormalisation: (module, model) => {
        module.logger.verbose('Performing status cleanup...');
        return model.update({ status: consts.DEPLOY_STATUS_STARTED }, { status: consts.DEPLOY_STATUS_UNKNOWN }, {multi: true})
            .exec()
            .then(i => module.logger.verbose('Status cleanup completed.'))
            .catch(ex => module.logger.error(ex));
    },
    performLogCleanup: (module, model) => {
        module.logger.verbose('Performing log cleanup...');
        var now = new Date();
        now.setDate(now.getDate() - 7);
        return model.remove({ date: { $lt: now }})
            .exec()
            .then(i => module.logger.verbose('Log cleanup completed.'))
            .catch(ex => module.logger.error(ex));
    },
    generateDeployResult: (m) => {
        var color = 'danger',
            result = 'Erro';
        if(m.status === consts.DEPLOY_STATUS_STARTED) {
            color = 'warning';
            result = 'Em progresso';
        } else if(m.status === consts.DEPLOY_STATUS_COMPLETED) {
            color = 'good';
            result = 'Concluído';
        } else if(m.status == consts.DEPLOY_STATUS_ABORTED) {
            result = 'Abortado';
        } else if(m.status == consts.DEPLOY_STATUS_UNKNOWN) {
            result = 'Perdido';
            color = 'no_color';
        }

        var tag = timeago();
        tag.register('pt_BR', timeagoPtBRLocale);

        var short = true,
            mrkdwn_in = ['text', 'value', 'fields'],
            unfurl_links = true;
            short_attr = (title, value) => ({ title, value, short, mrkdwn_in });
        var fields = [
            short_attr('Deployer', `@${m.starter}`),
            short_attr('Projeto', `\`${m.project}\``),
            short_attr('Data', m.date.toLocaleString()),
            short_attr('Status', result),
        ];
        var partialResult = { color, mrkdwn_in, fields },
            httpAsync = new Promise(r => r(partialResult));
        if(m.status === consts.DEPLOY_STATUS_STARTED) {
            fields.push({ value: '```(Deploy em progresso...)```'});
        } else {
            if(m.result.length > 900 || m.result.split('\n').length > 40) {
                // Slack would strip our response. Let's just upload a gist and handle it over to the user.
                if(m.gistUrl) {
                    fields.push({ value: `O resultado é muito grande para ser mostrado no Slack. Gerei um Gist com ele:\n<${m.gistUrl}>`, unfurl_links });
                } else {
                    httpAsync = new Promise((resolve) => {
                        github.client().gist().create({
                            description: `Deploy ${m._id} on ${m.project}`,
                            files: {
                                deployResult: { content: m.result }
                            }
                        }, (err, data) => {
                            if(err) {
                                fields.push({ value: 'Minha tentativa de upload do resultado para o Gist falhou. :(' });
                            } else {
                                m.gistUrl = data.html_url;
                                m.save();
                                fields.push({ value: `O resultado é muito grande para ser mostrado no Slack. Gerei um Gist com ele:\n<${data.html_url}>`, unfurl_links });
                            }
                            resolve(partialResult);
                        });
                    });
                }
            } else {
                fields.push({ value: '```' + m.result + '```' });
            }
        }
        return httpAsync;
    }
}
