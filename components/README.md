Componentes de interface reutilizáveis.

`ProdutoCard`, `PainelDashboard`, `EmptyState` e `IndicadorSincronizacao` obtêm as cores do tema ativo (claro ou escuro) pelo hook `useTema()` de `theme/ThemeContext.js` (TEMA-01), então precisam estar dentro do `ThemeProvider` (o `App.js` envolve o app com ele).

- `ProdutoCard.js` — cartão do produto (recebe `produto` e `situacao` prontos; não calcula datas).
- `EmptyState.js` — estado de lista vazia com chamada para ação.
- `PainelDashboard.js` — painel "vencendo esta semana" com os contadores do `ServicoDashboard.resumirProdutos` (não calcula nada).
- `IndicadorSincronizacao.js` (APP-08) — banner de status da sincronização no topo da `TelaInicial`. Recebe `pendentes`, `sincronizando` e `aoSincronizar` por props e **não** acessa a fila nem o repositório. Fica oculto sem pendências e sem sincronização em andamento. Com pendências, mostra "Modo offline: X alteração(ões) aguardando conexão" (singular ou plural) e a dica "Toque para tentar agora"; durante o envio, mostra "Sincronizando..." com indicador e fica desabilitado. Tocar chama `aoSincronizar`. Cores e espaçamentos do tema central (`cores.aviso`, `cores.fundoAviso`, `cores.fundoInfo`).
