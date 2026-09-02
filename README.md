# Gerenciador de Campeonatos Pokémon

Aplicação web modular para campeonatos pequenos, com foco em 7 ou 8 participantes.

## Formato automático

- 7 ou 8 participantes: 3 rodadas suíças e Top 4.
- 7 participantes: 3 confrontos e 1 BYE por rodada.
- 8 participantes: 4 confrontos por rodada.
- Top 4: 1º × 4º e 2º × 3º.
- Vitória vale 3 pontos, empate 1 e derrota 0.
- Desempates: OMW%, aproveitamento de games, games vencidos e ordem inicial.

O organizador ainda pode definir manualmente a quantidade de rodadas e o tamanho do Top Cut.

## Pareamento suíço

Para grupos de até 12 participantes, o motor compara todas as combinações possíveis e escolhe a de menor penalidade. A prioridade é:

1. evitar revanche;
2. aproximar participantes com a mesma pontuação;
3. impedir BYE repetido;
4. entregar o BYE ao participante pior classificado que ainda não o recebeu.

Para grupos maiores, o sistema usa uma estratégia gulosa para evitar travamentos no navegador.

## Estrutura

- `js/app.js`: controlador da interface.
- `js/config/tournament-format.js`: formato automático por quantidade de participantes.
- `js/data/storage.js`: persistência isolada no `localStorage` e migração da versão anterior.
- `js/domain/standings.js`: classificação e critérios de desempate.
- `js/domain/pairing-engine.js`: formação otimizada das rodadas suíças.
- `js/domain/elimination-engine.js`: Top Cut e eliminação simples.
- `js/domain/bracket-engine.js`: coordenação das fases do campeonato.
- `js/ui/dashboard-view.js`: renderização do painel de campeonatos.
- `tests/bracket-engine.test.js`: testes de 7 e 8 participantes.

## Executar

Como o projeto utiliza módulos JavaScript, abra-o por um servidor local. Exemplos:

```bash
python -m http.server 8000
```

Depois, acesse `http://localhost:8000`.

## Testar

```bash
node tests/bracket-engine.test.js
```

## Banco de dados futuramente

O armazenamento está isolado em `js/data/storage.js`. Para usar uma API, basta criar outro repositório com os métodos `list`, `get`, `save`, `create`, `remove` e `duplicate`, e trocar a importação em `js/app.js`. O motor de campeonato não depende do `localStorage`.
