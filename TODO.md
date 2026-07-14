# TODO
- level 50 e fake, ver porque colocou e se tem como nao ser fake
- varias pages client ajustar e componentizar oq for preciso
- configurar o projeto
- Api client com react query tan stack 

# Estrutura organizacional a implementar
raiz/
    /.claude
    /.next
    /prisma
    /src
        /app
        /layouts
            /components
            layout.tsx
        /modules

# SEGURANCA
- verificar BYPASS, tanto pra api > banco de dados , tanto pra battle > banco de dados
com certeza deve ter mt bypass kkkkk
- verificar idor tbm
- ver sobre refreshtoken e token expires na tabella Account e se devemos usar



# MELHORIA
- sistema de abrir pacote pra obter pokemons, pokemons vao ser mais dificil conseguir
baseado em algum stats que define fortitude, quando maior esse stats menor a chance dele ser sortido


# PRISMA CLIENT 



# VERIFICAR ISSO

Documenta o padrão como ele realmente é, não como seria bonito. Pontos que fiz questão de deixar explícitos:

CQRS lite, com um aviso. Botei em destaque que aqui CQRS é separação por pasta — sem event store, sem event bus, sem read model. Sem isso, o próximo agente lê "CQRS" e te entrega um Kafka.

Tabela de dependência entre pastas. Quem pode importar quem. A linha que mais importa: ui/ não pode importar Prisma nem commands/queries — senão o Prisma vaza pro bundle do browser.

As regras estão escritas como sintoma, não como teoria. Ex., a regra 1 diz literalmente: "o sintoma de que você errou é a page virar servidor renderizando um único componente cliente que é a página inteira" — que foi exatamente o meu erro no começo. Documentei o erro, não só o acerto.

Também estão lá: o par getBattleState (escreve) vs readBattleState (só lê), a proibição de escrita no render, o DTO obrigatório com o caso real do pendingMoves, as restrições de serverless (cron 1x/dia no Hobby → resolução na leitura → atomicidade crítica), e a dívida conhecida.