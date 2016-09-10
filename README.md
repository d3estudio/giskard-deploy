# giskard-deploy
> Piece-of-cake deploy system

> **Dependency Warning**: Depends on [giskard-roles](https://github.com/giskard-bot/giskard-roles) or else you and other users won't be able to perform deploys!

- `Configure suas chaves / deploy.config.keys`
    -  Inicia o assistente de configuração para obtenção de um KeyPair.
- `Qual sua chave publica? / deploy.pubkey`
    -  Retorna o valor da chave publica pertencente à KeyPair do bot.
- `Configure deploy (para `appname`) / deploy.new`
    -  Inicia o assistente de configuração de projeto.
- `Liste projetos de deploy / Liste deploys configurados / deploy.list`
    -  Lista todos os projetos configurados para deploy.
- `Esqueça o projeto `appname` / deploy.forget `appname``
    -  Remove configurações de um determinado projeto da base.
- `Deploy `appname``
    -  Inicia um processo de deploy para `appname`
- `(Mostre os)( últimos )deploys em `appname`/deploy.history `appname``
    -  Exibe uma lista com os últimos deploys executados contra `appname`.
- `Mostre o resultado do deploy `id`/deploy.show `id``
    -  Mostra o resultado do deploy com id `id`
- `(Mostre os )(últimos )deploys em `appname`/deploy.history `appname``
    -  Mostra uma lista com os últimos 10 deploys executados contra `appname`
