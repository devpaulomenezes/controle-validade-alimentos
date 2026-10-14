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

O contrato de dados é a base para que os integrantes desenvolvam suas partes de forma independente, usando dados mockados contra essa interface. A implementação concreta em JSON (`JsonProdutoRepository`) será feita na issue #3.

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

## Estrutura de pastas (implementada na issue #1)

    app/           → telas (navegação via React Navigation: TelaInicial.js e TelaCadastro.js)
    components/    → componentes reutilizáveis (theme.js, ProdutoCard.js, EmptyState.js, formatoData.js)
    services/      → ServicoValidade, ServicoDashboard, NotificacoesService, CameraService
    data/          → ProdutoRepository (interface) + JsonProdutoRepository (Etapa 1)
    mocks/         → mocks TEMPORÁRIOS do bloco de interface (removidos na issue #10)

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
- Ao salvar, cria um `Produto` do contrato (id e `dataDeCadastro` gerados localmente),
  grava no **mock em memória** (`mocks/MockProdutoRepository`, que segue a interface
  `ProdutoRepository`), mostra "Produto salvo" e volta à tela inicial. O produto salvo
  aparece no console do Metro. A persistência real entra na issue #10.

## Interface: tela de listagem (issue #9)

- A tela inicial lista os produtos com o `ProdutoCard`, **ordenados pela validade mais próxima**,
  e recarrega ao ganhar foco (o produto recém-cadastrado aparece ao voltar do cadastro).
- **Busca local** por nome enquanto o usuário digita, sem diferenciar maiúsculas e acentos
  ("lei" encontra "Leite"; "feijao" encontra "Feijão").
- **Filtro por situação**: Todas / Vencidos / Vencem esta semana / Vencem este mês / Ok.
- **EmptyState** quando não há produtos (com botão para cadastrar) e quando a busca ou o filtro
  não encontram nada. Botão "+ Novo" no cabeçalho para abrir o cadastro.
- A tela **não calcula datas**: a situação e a ordenação vêm de `mocks/servicosMock.js`, que tem
  as mesmas assinaturas do `ServicoValidade.classificarSituacao` (#4) e do
  `ServicoDashboard.ordenarPorValidade` (#5). Na #10 basta trocar os imports pelos serviços reais.
- **Dados mock:** `mocks/produtosMock.js` traz 9 produtos com validades relativas a hoje (todas as
  situações e vários "Leite ..." para a busca). Para ver o EmptyState, troque
  `SEMEAR_DADOS_MOCK` para `false` em `mocks/MockProdutoRepository.js`.

## Recursos do dispositivo: câmera e galeria (issue #11)

- **`CameraService` (`services/CameraService.js`)**:
  - Métodos estáticos `tirarFoto()` (abre a câmera) e `escolherDaGaleria()` (abre a galeria).
  - Trata permissões nos três estados: concedida, negada (mensagem clara ao usuário) e negada permanentemente (direcionamento às configurações do sistema via `Linking.openSettings()`).
  - Captura com qualidade comprimida (`quality: 0.6`, `allowsEditing: false`, `mediaTypes: ['images']`), sem guardar imagem original desnecessariamente pesada.
  - Cancelamento gracioso: fechar câmera ou galeria retorna `null` sem quebrar o fluxo nem gerar erro.
  - Retorna string com a URI local da imagem, atendendo ao campo `fotoUri` do contrato `Produto` (#1).
- **Tela de teste temporária (`TelaTesteCamera.js`)**:
  - Validação isolada com botões "Tirar foto" e "Escolher da galeria".
  - Exibe a imagem capturada e a URI retornada, com botão para limpar.
  - Acessível pelo menu "🧪 Testes" no cabeçalho da `TelaInicial`.

## Recursos do dispositivo: notificações locais (issue #12)

- **`NotificacoesService` (`services/NotificacoesService.js`)**:
  - Serviço puro que recebe o `Produto` como parâmetro (sem acoplamento com repositório).
  - Alertas locais configurados com `expo-notifications`, canal Android com prioridade alta e handler para exibição com app em primeiro plano.
  - Regra de antecedência de 3 dias: produtos vencendo em até 3 dias (ou já vencidos) disparam notificação imediata (em 2s); produtos com folga maior são agendados para 3 dias antes da validade, às 09:00.
  - Mensagens em português adaptadas ("venceu há X dias!", "vence hoje!", "vence amanhã!", "vence em X dias!").
  - Trata permissões com aviso claro e link para as configurações do sistema (`Linking.openSettings()`).
  - Funções auxiliares `listarAgendadas()` e `cancelarTodas()`.
- **Tela de teste temporária (`TelaTesteNotificacoes.js`)**:
  - Botões para agendar 3 cenários de teste: "Vence amanhã" (alerta imediato), "Já vencido" (alerta imediato) e "Com folga" (agenda para o futuro).
  - Listagem dos agendamentos ativos no sistema com opção de cancelamento em massa.
  - Acessível pelo menu "🧪 Testes" no cabeçalho da `TelaInicial`.

## Recursos do dispositivo: integração da foto no fluxo do app (issue #13)

- **Persistência de imagens (`CameraService.persistirFoto`)**:
  - Salva as fotos temporárias da câmera e da galeria na pasta permanente de documentos do aplicativo (`FileSystem.documentDirectory/fotos/`), impedindo perda de dados quando o sistema operacional limpa o cache do aparelho.
- **Tela de cadastro (`TelaCadastro.js`)**:
  - Botão "📷 Adicionar foto" integrado ao formulário, permitindo escolher entre capturar pela câmera ou escolher da galeria via `CameraService`.
  - Exibição da pré-visualização da imagem com opção de alterar ou remover foto.
  - Gravação do produto com a URI persistente no campo `fotoUri` ou `null` quando salvo sem foto.
- **Cartão do produto (`ProdutoCard.js`)**:
  - Exibe a foto persistida do produto quando `fotoUri` estiver definido.
  - Exibe placeholder estilizado com ícone `🥫` quando o produto for cadastrado sem foto ou em caso de falha no carregamento (`onError`).

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

    npm install\
    npx expo start

Escaneie o QR Code com o Expo Go (celular e PC na mesma rede Wi-Fi).

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
