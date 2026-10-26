# Controle de Validade de Alimentos

Aplicativo mobile (React Native + Expo) para registro e controle de produtos perecíveis:
cadastro com foto, alerta de itens "vencendo esta semana" e notificações locais antes do vencimento.

**Disciplina:** Programação para Dispositivos Móveis
**Grupo:** Paulo Moura, Arthur Alexandre e João Victor Lucena

## Decisões do projeto (fonte de verdade)

- **Plataforma:** Android · **Stack:** React Native (JSX) com Expo, testado no Expo Go
- **Navegação:** React Navigation configurado (native stack, rotas: Inicial e Cadastro). Template blank, expo-router descartado.
- **Escopo da Etapa 1:** CRUD completo com persistência local em JSON (expo-file-system)
- **Escopo da Etapa 2:** persistência em banco REMOTO via API (mesma interface do repositório)
- **Identificação do produto:** foto do alimento/rótulo pela câmera. Sem código de barras e sem
  OCR (a validade não vem do EAN; a entrada de data é manual com date picker). OCR descartado
  do MVP por instabilidade técnica.
- **Notificações:** locais, 3 dias antes do vencimento (expo-notifications; atenção à permissão
  no Android 13+)

## Arquitetura e padrão de projeto

Padrão central: **Repository**, em arquitetura em camadas (MVC simplificado).

    Tela (Screen) → ServicoValidade (regras de negócio) → ProdutoRepository (interface)
                                                              ↓
                                                  JsonProdutoRepository (Etapa 1)
                                                              ↓
                                                  produtos.json (FileSystem do dispositivo)

- **Por que Repository:** as telas nunca acessam a origem dos dados diretamente. Na Etapa 2,
  troca-se apenas a implementação (JsonProdutoRepository → ApiProdutoRepository) sem alterar telas.
- **Singleton** no repositório: fonte de verdade única para todas as telas.
- **Modelo:** Produto = id, nome, quantidade, dataDeValidade, fotoUri, dataDeCadastro.
  Regras de vencimento (dias restantes; vencido / esta semana / este mês / ok) centralizadas
  no ServicoValidade.

## Contrato de dados (acordado na issue #1)

O contrato de dados é a base para que os integrantes desenvolvam suas partes de forma independente, usando dados mockados contra essa interface. A implementação concreta em JSON (`JsonProdutoRepository`) foi concluída na issue #3 — ver seção abaixo.

**Modelo `Produto`:**
- `id`: Identificador único do produto.
- `nome`: Nome do produto.
- `quantidade`: Quantidade em estoque.
- `dataDeValidade`: Data de validade em formato ISO 8601 (YYYY-MM-DD), armazenada como string.
- `fotoUri`: URI local da foto do produto/rótulo.
- `dataDeCadastro`: Data de cadastro em formato ISO 8601, armazenada como string.

**Interface `ProdutoRepository`:**
- `listar()`: Lista todos os produtos cadastrados.
- `salvar(produto)`: Salva um novo produto.
- `atualizar(produto)`: Atualiza um produto existente.
- `remover(id)`: Remove um produto pelo seu ID.
- `buscarPorId(id)`: Retorna um produto específico pelo ID.

## Dados: JsonProdutoRepository (issue #3)

- **`data/JsonProdutoRepository.js`**: primeira implementação real do contrato
  `ProdutoRepository` (#1), estendendo a classe da interface.
- **Singleton**: `export default new JsonProdutoRepository()`.
- **Persistência**: array de produtos serializado em `produtos.json`, na pasta de
  documentos do app (`FileSystem.documentDirectory`); enquanto o arquivo não existe,
  `listar()` devolve `[]`, e ele é criado na primeira gravação e relido a cada
  operação. Os dados sobrevivem ao fechar e reabrir o app.
- **FileSystem**: usa a mesma API do `CameraService` — `expo-file-system/legacy`
  (`getInfoAsync`, `readAsStringAsync`, `writeAsStringAsync`), alinhada ao SDK 57.
- **Id e data de cadastro**: `salvar()` gera `id` e `dataDeCadastro` (ISO) para
  produtos que chegam sem eles — a tela de cadastro não gera nenhum dos dois (#10);
  valores já informados são mantidos.
- **`dataDeValidade`**: persiste exatamente como string ISO (`'YYYY-MM-DD'`), sem
  conversão de data — decisão do contrato da #1.
- **Erros de leitura/escrita**: capturados com mensagem clara no console
  (`[JsonProdutoRepository] ...`), sem travar o app; leitura com problema trata a
  base como vazia e escrita com falha fica registrada no console.
- **Usado pelas telas** `TelaInicial` e `TelaCadastro` desde a issue #10.

## Regras de vencimento: ServicoValidade (issue #4)

- **`services/ServicoValidade.js`**: regras de vencimento centralizadas na
  camada de serviços — nenhuma tela calcula datas. Serviço puro: recebe o
  `Produto` como parâmetro e não acessa repositório.
- **`calcularDiasRestantes(dataDeValidade)`**: diferença em dias inteiros entre
  a validade e hoje, considerando apenas a DATA (ignora hora) e sem deslocamento
  de fuso — parse local via `isoParaData` (formatoData), nunca
  `new Date('YYYY-MM-DD')` (UTC) nem `toISOString()`.
- **`classificarSituacao(produto)`**: `vencido` (dias < 0), `venceEstaSemana`
  (0 a 7 dias, inclusive hoje), `venceEsteMes` (8 a 30 dias) e `ok` (mais de
  30 dias); as cores das situações (theme da #7) usam essas chaves.
- **Tela de teste temporária** (`TelaTesteServicoValidade`): exibiu os
  casos-limite (ontem, hoje, +7, +8 e +35 dias) com dias restantes e situação
  calculados pelo serviço; removida na #10 junto com os mocks.
- **Uso**: desde a #10 é a única fonte do cálculo de datas — usado pela
  `TelaInicial`, pelo `ServicoDashboard` e pelo `NotificacoesService`.

## Agregações do dashboard: ServicoDashboard (issue #5)

- **`services/ServicoDashboard.js`**: agregações do dashboard centralizadas
  na camada de serviços — nenhuma tela agrega dados. Serviço puro: recebe
  os produtos como parâmetro e não acessa repositório.
- **`resumirProdutos(produtos)`**: retorna `{ total, vencidos,
  venceEstaSemana, venceEsteMes, ok }`; a classificação de cada produto é
  delegada ao `classificarSituacao` do ServicoValidade (nenhum cálculo de
  data duplicado), então a soma dos quatro contadores é sempre igual ao
  `total`. O contador de `vencido` se chama `vencidos` (com S), nome que o
  `PainelDashboard` usa.
- **`ordenarPorValidade(produtos)`**: nova lista ordenada pela validade mais
  próxima (compara as strings `'YYYY-MM-DD'`, que em ordem alfabética já
  ficam em ordem cronológica); não altera a lista original.
- **Validação**: a tela de teste temporária da #4
  (`TelaTesteServicoValidade`) foi estendida com uma seção "Dashboard" que
  exibia os 5 contadores, a soma dos contadores ao lado do total e a lista
  ordenada — removida na #10 junto com os mocks.
- **Uso**: alimenta a ordenação da listagem e o `PainelDashboard` da
  `TelaInicial` desde a #10.

## Estrutura de pastas (implementada na issue #1)

    app/           → telas (navegação via React Navigation: TelaInicial.js e TelaCadastro.js)
    components/    → componentes reutilizáveis (theme.js, ProdutoCard.js, EmptyState.js, PainelDashboard.js, formatoData.js)
    services/      → ServicoValidade (implementado na issue #4), ServicoDashboard (implementado na issue #5), NotificacoesService, CameraService
    data/          → ProdutoRepository (interface) + JsonProdutoRepository (implementado na issue #3)
    __tests__/     → testes unitários (issue #6) e de integração (issue #14) com Jest

A pasta `mocks/` (dados e serviços temporários do bloco de interface) foi removida na issue #10.

## Interface: tema e componentes (issue #7)

- **Tema central** (`components/theme.js`): paleta de cores, espaçamentos, raios, tamanhos de
  fonte e estilos base (`estilosBase`). Telas e componentes importam daqui — nada de cores soltas.
- **Cores das situações** (chaves iguais às do `ServicoValidade.classificarSituacao`, issue #4):
  vermelho = `vencido`, amarelo = `venceEstaSemana`, azul = `venceEsteMes`, verde = `ok`.
- **`ProdutoCard`**: recebe `produto` (contrato da #1) e `situacao` (já classificada) e exibe nome,
  quantidade, validade (DD/MM/AAAA), foto quando houver e o selo colorido da situação.
  **Não calcula datas** — só exibe o que recebe.
- **`EmptyState`**: estado de lista vazia com ícone, mensagem e botão de ação opcional.
- **Tela de teste temporária** (`TelaTesteComponentes`): usada na #7 para validar um cartão em
  cada situação e o EmptyState; removida na #9, quando a listagem real passou a usar os componentes.

## Interface: tela de cadastro (issue #8)

- Formulário com **nome**, **quantidade** e **data de validade**, e botão "Salvar".
- **Date picker:** `@react-native-community/datetimepicker` (incluído no Expo Go; instalado com
  `npx expo install`). No Android usa a API imperativa `DateTimePickerAndroid.open`, recomendada
  pela biblioteca. A data é gravada no formato do contrato (`'YYYY-MM-DD'`) a partir da data
  **local** — sem `toISOString()`, que converte para UTC e pode adiantar um dia à noite.
- **Validação** (mensagens em português): nome obrigatório, quantidade inteira maior que zero e
  data obrigatória. Datas passadas são aceitas (o produto pode já estar vencido).
- Ao salvar, cria um `Produto` do contrato e grava no **`JsonProdutoRepository`** (#3), que gera
  `id` e `dataDeCadastro`; agenda o alerta de vencimento (`NotificacoesService.agendarAlerta`,
  #12), mostra "Produto salvo" e volta à tela inicial. Até a #10 o cadastro gravava num
  repositório mock em memória.

## Interface: tela de listagem (issue #9)

- A tela inicial lista os produtos com o `ProdutoCard`, **ordenados pela validade mais próxima**,
  e recarrega ao ganhar foco (o produto recém-cadastrado aparece ao voltar do cadastro).
- **Busca local** por nome enquanto o usuário digita, sem diferenciar maiúsculas e acentos
  ("lei" encontra "Leite"; "feijao" encontra "Feijão").
- **Filtro por situação**: Todas / Vencidos / Vencem esta semana / Vencem este mês / Ok.
- **EmptyState** quando não há produtos (com botão para cadastrar) e quando a busca ou o filtro
  não encontram nada. Botão "+ Novo" no cabeçalho para abrir o cadastro.
- A tela **não calcula datas**: a situação vem de `ServicoValidade.classificarSituacao` (#4) e a
  ordenação de `ServicoDashboard.ordenarPorValidade` (#5). Os produtos vêm do
  `JsonProdutoRepository` (#3); na primeira execução a lista está vazia e aparece o EmptyState.
  Até a #10 a listagem usava produtos e serviços mock com as mesmas assinaturas.

## Interface: dashboard, remoção e integração com os dados (issue #10)

- **Painel no topo da tela inicial** (`components/PainelDashboard.js`): destaque em âmbar com a
  quantidade de produtos que **vencem esta semana** e contadores de vencidos, deste mês e do total.
  Tocar num contador aplica o filtro correspondente da listagem (o total volta para "Todas").
- Os números vêm de `ServicoDashboard.resumirProdutos(produtos)` (#5):
  `{ total, vencidos, venceEstaSemana, venceEsteMes, ok }`. A classificação é delegada ao
  `ServicoValidade`, então a soma dos contadores é sempre igual ao total.
- **Remoção de produto**: botão "Remover" em cada cartão, com confirmação; chama `remover(id)` do
  `JsonProdutoRepository` e recarrega a lista e o painel.
- **Sem mocks no fluxo principal**: `TelaInicial` e `TelaCadastro` usam o `JsonProdutoRepository`
  (#3), o `ServicoValidade` (#4) e o `ServicoDashboard` (#5). A pasta `mocks/` e a tela de teste
  temporária `TelaTesteServicoValidade` foram removidas.
- **Cálculo de datas em um só lugar**: o `NotificacoesService` (#12) passou a usar o
  `calcularDiasRestantes` do `ServicoValidade` em vez de uma cópia própria.
- **Alerta ao cadastrar**: ao salvar, o cadastro chama `NotificacoesService.agendarAlerta(produto)`,
  que agenda o aviso 3 dias antes do vencimento (ou dispara na hora, se faltar menos que isso).
- **Falha na cópia da foto**: se `CameraService.persistirFoto` não conseguir copiar a foto, o
  cadastro pergunta se o produto deve ser salvo sem foto, em vez de salvar sem ela em silêncio.

## Recursos do dispositivo: câmera e galeria (issue #11)

- **`CameraService` (`services/CameraService.js`)**:
  - Métodos estáticos `tirarFoto()` (abre a câmera) e `escolherDaGaleria()` (abre a galeria).
  - Trata permissões nos três estados: concedida, negada (mensagem clara ao usuário) e negada permanentemente (direcionamento às configurações do sistema via `Linking.openSettings()`).
  - Captura com qualidade comprimida (`quality: 0.6`, `allowsEditing: false`, `mediaTypes: ['images']`), sem guardar imagem original desnecessariamente pesada.
  - Cancelamento gracioso: fechar câmera ou galeria retorna `null` sem quebrar o fluxo nem gerar erro.
  - Retorna string com a URI local da imagem, atendendo ao campo `fotoUri` do contrato `Produto` (#1).
- **Tela de teste temporária (`TelaTesteCamera.js`)**:
  - Usada na #11 para validação isolada, com botões "Tirar foto" e "Escolher da galeria".
  - Removida na #14, quando o fluxo real do cadastro passou a ser validado de ponta a ponta.

## Recursos do dispositivo: notificações locais (issue #12)

- **`NotificacoesService` (`services/NotificacoesService.js`)**:
  - Serviço puro que recebe o `Produto` como parâmetro (sem acoplamento com repositório).
  - Alertas locais configurados com `expo-notifications`, canal Android com prioridade alta e handler para exibição com app em primeiro plano.
  - Regra de antecedência de 3 dias: produtos vencendo em até 3 dias (ou já vencidos) disparam notificação imediata (em 2s); produtos com folga maior são agendados para 3 dias antes da validade, às 09:00.
  - Mensagens em português adaptadas ("venceu há X dias!", "vence hoje!", "vence amanhã!", "vence em X dias!").
  - Trata permissões com aviso claro e link para as configurações do sistema (`Linking.openSettings()`).
  - Funções auxiliares `listarAgendadas()` e `cancelarTodas()`.
  - Dias restantes calculados pelo `ServicoValidade` (#4) desde a #10; o `agendarAlerta` é chamado pela `TelaCadastro` ao salvar cada produto.
- **Tela de teste temporária (`TelaTesteNotificacoes.js`)**:
  - Usada na #12 para agendar 3 cenários ("Vence amanhã", "Já vencido" e "Com folga") e listar/cancelar os agendamentos.
  - Removida na #14, quando o alerta ao cadastrar passou a ser validado no fluxo real.

## Recursos do dispositivo: integração da foto no fluxo do app (issue #13)

- **Persistência de imagens (`CameraService.persistirFoto`)**:
  - Salva as fotos temporárias da câmera e da galeria na pasta permanente de documentos do aplicativo (`FileSystem.documentDirectory/fotos/`), impedindo perda de dados quando o sistema operacional limpa o cache do aparelho.
- **Tela de cadastro (`TelaCadastro.js`)**:
  - Botão "Adicionar foto" integrado ao formulário, permitindo escolher entre capturar pela câmera ou escolher da galeria via `CameraService`.
  - Exibição da pré-visualização da imagem com os botões "Trocar foto" e "Remover foto".
  - Gravação do produto com a URI persistente no campo `fotoUri` ou `null` quando salvo sem foto; se a cópia da foto falhar, o usuário escolhe se salva sem foto (#10).
- **Cartão do produto (`ProdutoCard.js`)**:
  - Exibe a foto persistida do produto quando `fotoUri` estiver definido.
  - Exibe placeholder estilizado com ícone `🥫` quando o produto for cadastrado sem foto ou em caso de falha no carregamento (`onError`).

## Validação final da Etapa 1 (issue #14)

- **Testes de integração** (`__tests__/IntegracaoEtapa1.test.js`): exercitam `JsonProdutoRepository`,
  `ServicoValidade`, `ServicoDashboard`, `CameraService.persistirFoto` e `NotificacoesService.agendarAlerta`
  em conjunto, com o cenário de 5 produtos (1 vencido, 2 vencendo esta semana — um com foto e um sem —,
  1 vencendo este mês e 1 ok). Conferem a persistência em `produtos.json`, a foto persistida, a ordenação
  por validade, a classificação, os contadores do dashboard antes e depois de uma remoção e os alertas
  (imediato para quem vence em até 3 dias, agendado para quem tem folga).
- **Validação manual no Expo Go (SDK 57, Android)** — resultado: **sem erros**.
  - Cadastro com foto pela câmera, salvamento e persistência em `produtos.json`.
  - Listagem ordenada por validade, busca por nome e filtro por situação.
  - Painel do dashboard com os contadores corretos para os 5 produtos e atualização ao remover.
  - Notificação local ao cadastrar produto vencendo em menos de 3 dias.
  - Foto e produtos continuam visíveis após fechar e reabrir o app.
- **Limpeza**: as telas de teste temporárias (`TelaTesteCamera` e `TelaTesteNotificacoes`), suas rotas no
  `App.js` e o botão "Testes" do cabeçalho foram removidos; o fluxo real cobre as duas validações.
- **Testes unitários da #6** continuam passando após as integrações (`npx jest`).

## Fluxo de trabalho Git (regra do grupo)

- Desenvolvimento exclusivamente na branch **`dev`**
- Merge para **`main`** quando estável — `main` é a branch de publicação/entrega
- **Toda outra branch é excluída** após ser mesclada (nada de branches permanentes extras)
- Mensagens de commit no padrão **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`)
- Commits finais feitos pelo grupo, após revisão das alterações

## Divisão de responsabilidades — Etapa 1

Cada integrante é responsável por 4 issues, desenvolvidas de forma independente
contra o contrato de dados definido na issue #1 (modelo `Produto` e interface
`ProdutoRepository`), usando mocks onde a integração só ocorre no fim do bloco.

| Integrante | Bloco | Issues | Responsabilidades |
|---|---|---|---|
| Paulo Moura | Dados e regras | #3–#6 | `JsonProdutoRepository` (CRUD em JSON), `ServicoValidade` (regras de vencimento), `ServicoDashboard` (agregações), testes unitários |
| Arthur Alexandre | Interface | #7–#10 | Tema visual e componentes reutilizáveis, tela de cadastro (formulário + date picker), tela de listagem (busca e filtro), dashboard "vencendo esta semana" e troca do mock pelo repositório real |
| João Victor Lucena | Recursos do dispositivo | #11–#14 | `CameraService` (foto/galeria com permissões), `NotificacoesService` (alertas locais 3 dias antes do vencimento), integração da foto no fluxo do app, testes de integração e validação final |

## Regra de manutenção deste README

⚠️ Este README é **fonte de verdade viva**: a cada issue concluída, ele deve ser
corrigido/adaptado para permanecer coerente com o contexto e o andamento do projeto.
Manter o README atualizado integra os critérios de aceite de cada issue no GitHub.

## Licença

Distribuído sob a **Licença MIT** — ver o arquivo `LICENSE`.
Copyright (c) 2026 Paulo Moura Menezes, Arthur Alexandre e João Victor Lucena.

## Como executar

    npm install
    npx expo start

Escaneie o QR Code com o Expo Go (celular e PC na mesma rede Wi-Fi).

## Testes

Testes unitários e de integração executados com **Jest** utilizando o preset **`jest-expo`**.

    npm test
    # ou
    npx jest

- **`ServicoValidade` (`__tests__/ServicoValidade.test.js`)**: testes das funções `calcularDiasRestantes` (passado, hoje e futuro) e `classificarSituacao` cobrindo todos os casos-limite da issue #4 (`vencido`, `venceEstaSemana`, `venceEsteMes` e `ok`).
- **`JsonProdutoRepository` (`__tests__/JsonProdutoRepository.test.js`)**: testes de persistência cobrindo o fluxo completo de CRUD (salvar com id gerado, buscarPorId, atualizar e remover), a geração de `id` e `dataDeCadastro` quando o produto chega sem eles e o caso de arquivo inexistente (retorna lista vazia sem erro), com mock em memória de `expo-file-system/legacy`.
- **`IntegracaoEtapa1` (`__tests__/IntegracaoEtapa1.test.js`)**: testes de integração da Etapa 1 (issue #14) verificando as peças funcionando em conjunto (`JsonProdutoRepository`, `ServicoValidade`, `ServicoDashboard`, `CameraService.persistirFoto` e `NotificacoesService.agendarAlerta`) no cenário completo de 5 produtos.

## Histórico de decisões

- 2026-10-01 — Repositório inicializado; scaffold do Expo (template blank) mesclado ao `main`;
  `.gitignore` unificado; fluxo de branches `dev` → `main` definido.
- 2026-10-01 — Licença do template do Expo substituída por MIT própria do grupo; README
  consolidado com navegação via React Navigation.
- 2026-10-02 — Plano da Etapa 1 concluído: 14 issues criadas no GitHub (2 de
  fundação + 4 por integrante, blocos independentes contra o contrato da #1);
  `NotificacoesService` movida para o bloco do João;   labels `setup`, `feat` e `docs` configuradas.
- 2026-10-02 — Issue #1 concluída: estrutura de pastas (app, components, services, data) criada; contrato de dados definido (Produto + ProdutoRepository), base para os blocos independentes da Etapa 1.
- 2026-10-02 — Issue #2 concluída: React Navigation configurado (NavigationContainer + native stack); telas TelaInicial e TelaCadastro criadas em app/; navegação Inicial → Cadastro → Voltar funcional.
- 2026-10-13 — Issue #7 concluída: tema visual central (`components/theme.js`) e componentes
  reutilizáveis `ProdutoCard` e `EmptyState`, validados na tela de teste temporária com produtos mock
  nas 4 situações; cabeçalho da navegação usando as cores do tema.
- 2026-10-13 — Issue #8 concluída: tela de cadastro com formulário validado e date picker
  (`@react-native-community/datetimepicker`), salvando em repositório mock em memória
  (`mocks/`), que segue o contrato da #1.
- 2026-10-13 — Issue #9 concluída: tela inicial transformada na listagem com `ProdutoCard`,
  ordenação por validade, busca local por nome, filtro por situação e EmptyState; situação e
  ordenação vindas de serviços mock com as assinaturas das issues #4 e #5; tela de teste da #7
  removida.
- 2026-10-14 — Issue #11 concluída: `CameraService` criado com `tirarFoto()` e `escolherDaGaleria()`, compressão de imagens, tratamento de permissões e cancelamento gracioso; validado na tela de teste `TelaTesteCamera`.
- 2026-10-14 — Issue #12 concluída: `NotificacoesService` criado com `agendarAlerta()`, regra de antecedência de 3 dias, mensagens em português e listagem de agendamentos; validado na tela de teste `TelaTesteNotificacoes`.
- 2026-10-14 — Issue #13 concluída: integração da captura de foto (câmera/galeria) no cadastro, persistência no FileSystem e exibição da foto ou placeholder no ProdutoCard.
- 2026-10-14 — Issue #10, parte visual: painel do dashboard "vencendo esta semana" e remoção de
  produto na tela inicial, ainda via mock; a troca pelo repositório e pelos serviços reais aguarda
  as issues #3 e #5. Alerta de foto do cadastro ajustado ao limite de 3 botões do Android.
- 2026-10-23 — Issue #3 concluída: `JsonProdutoRepository` (CRUD real em JSON via
  `expo-file-system/legacy`, arquivo `produtos.json` no documentDirectory, id
  gerado pelo repositório quando ausente, erros de leitura/escrita tratados no
  console). Telas seguem no mock até a #10.
- 2026-10-23 — Issue #4 concluída: `ServicoValidade` com
  `calcularDiasRestantes` e `classificarSituacao` (faixas vencido / esta
  semana / este mês / ok, iguais ao mock), cálculo só-data sem fuso e tela de
  teste temporária com os casos-limite. Telas seguem no mock até a #10.
- 2026-10-24 — Issue #5 concluída: `ServicoDashboard` com `resumirProdutos`
  (5 contadores, classificação delegada ao ServicoValidade, soma sempre
  igual ao total) e `ordenarPorValidade` (lista nova, sem mutar a original),
  semântica idêntica ao mock. Tela de teste temporária estendida com a
  seção "Dashboard". Telas seguem no mock até a #10.
- 2026-10-24 — Issue #6 concluída: configuração do Jest/jest-expo e testes unitários do bloco de dados (issue #6).
- 2026-10-24 — Issue #10 concluída: telas integradas ao `JsonProdutoRepository`, ao
  `ServicoValidade` e ao `ServicoDashboard`; `id` e `dataDeCadastro` gerados pelo repositório;
  alerta de vencimento agendado ao salvar; aviso quando a cópia da foto falha;
  `NotificacoesService` usando o cálculo de datas do `ServicoValidade`; pasta `mocks/` e
  `TelaTesteServicoValidade` removidas.
- 2026-10-24 — Issue #14 concluída (fim da Etapa 1): testes de integração com o cenário de 5
  produtos (`__tests__/IntegracaoEtapa1.test.js`), validação manual de ponta a ponta no Expo Go
  (SDK 57) sem erros e remoção das telas de teste temporárias `TelaTesteCamera` e
  `TelaTesteNotificacoes`, de suas rotas e do botão "Testes" do cabeçalho.

