# AGENTS.md — controle-validade-alimentos

## Visão geral
App mobile de controle de validade de alimentos (PDM — grupo Paulo Moura, Arthur
Alexandre e João Victor Lucena): React Native + Expo (SDK 57), template blank,
JSX, validado no Expo Go.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Arquitetura
- Padrão Repository em camadas: Tela → Serviço → ProdutoRepository (contrato em data/).
- Implementações estendem a classe da interface: JsonProdutoRepository (#3, JSON
  local em produtos.json) e, na Etapa 2, ApiProdutoRepository (API remota) — sem
  mudar as telas.
- Repositórios exportam Singleton (export default new ...).
- Telas e componentes NÃO calculam datas (ServicoValidade/ServicoDashboard calculam).
- expo-file-system: importar SEMPRE de 'expo-file-system/legacy' no SDK 57
  (padrão de services/CameraService.js).

## Estrutura de pastas
- app/ — telas (TelaInicial, TelaCadastro e telas de teste temporárias
  TelaTesteCamera/TelaTesteNotificacoes)
- components/ — theme.js, ProdutoCard, EmptyState, formatoData, PainelDashboard
- services/ — CameraService, NotificacoesService, ServicoValidade, ServicoDashboard
- data/ — Produto, ProdutoRepository (contrato), JsonProdutoRepository (implementação real)
- __tests__/ — testes unitários (Jest + jest-expo; `npx jest`)
- Não há mais mocks: a pasta mocks/ foi removida na issue #10.

## Estado atual (Etapa 1)
- Concluídas: #1 (contrato), #2 (navegação), #3 (JsonProdutoRepository),
  #4 (ServicoValidade), #5 (ServicoDashboard), #6 (testes unitários),
  #7–#13 (interface, integração com os dados e recursos do dispositivo).
- Pendência conhecida: #14 validação final.

## Convenções
- Código, comentários e mensagens em português (pt-BR); JSDoc nos arquivos de contrato.
- Estilos somente via components/theme.js.
- Instalar pacotes somente com `npx expo install <package>`.
- Lint com `npx eslint <caminhos>` (ex.: `npx eslint data`).
- Git: desenvolvimento exclusivo na branch `dev`; Conventional Commits
  (`feat:`, `fix:`, `chore:`, `docs:`); commit e push são do grupo, nunca do agente.
- README.md é fonte de verdade viva — toda issue concluída o atualiza.

## Navegação
React Navigation (native stack) configurado em App.js — rotas Inicial, Cadastro,
TesteCamera e TesteNotificacoes. NÃO usar expo-router (descartado no MVP).
