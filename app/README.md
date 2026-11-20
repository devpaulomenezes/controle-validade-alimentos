Telas do aplicativo (navegação via React Navigation).

## Sessão e navegação (APP-07)

`App.js` lê a sessão local ao abrir (`AuthService.obterSessao()`, sem rede, então funciona offline): com sessão, mostra a stack principal (`Inicial`, `Cadastro`, `TelaDetalhe`); sem sessão, mostra a `TelaLogin`, que avisa o login pelo callback `aoAutenticar`.

- Os dois conjuntos de rotas são filhos mutuamente exclusivos do mesmo `Stack.Navigator` (padrão de fluxo de autenticação do React Navigation). Quando `autenticado` muda, o navegador troca as rotas e zera o histórico, com o mesmo efeito de um `reset`: o "voltar" nunca retorna ao login depois de autenticar.
- O `usuarioId` não é repassado às telas por props: o `OfflineFirstProdutoRepository` o lê da sessão (`AuthService.obterUsuarioId()`) a cada operação, então as telas continuam sem conhecer a sessão nem a fila.

## Telas

- `TelaInicial.js` — painel "vencendo esta semana", listagem com busca por nome, filtro por situação e remoção. A cada foco, sincroniza o `OfflineFirstProdutoRepository` (envia a fila e baixa a base remota) e recarrega a lista. No topo, o banner `IndicadorSincronizacao` (APP-08) mostra as alterações aguardando conexão ou "Sincronizando...", e tocar nele sincroniza; "puxar para atualizar" (`RefreshControl`) faz o mesmo, com o indicador até a sincronização terminar. Os dois aparecem também com a lista vazia, e um pedido feito durante uma sincronização em andamento reaproveita a mesma, sem disparar outra. Botão **Sair** no cabeçalho: bloqueado enquanto houver alterações do usuário na fila (o aviso mostra a quantidade); sem pendências, limpa o cache local, apaga a sessão e volta ao login. Se a sincronização receber `401`, a sessão é apagada, a fila é mantida e o app volta ao login com o aviso "Sua sessão expirou. Entre novamente para sincronizar as alterações."; após o novo login, a fila é enviada normalmente.
- `TelaCadastro.js` — formulário de cadastro/edição com date picker e foto; salva no `OfflineFirstProdutoRepository` e agenda o alerta de vencimento.
- `TelaDetalhe.js` — foto, situação, dias restantes e data de cadastro; edição e remoção (via `OfflineFirstProdutoRepository`).
- `TelaLogin.js` (APP-06) — login e criação de conta, alternados por um botão. Valida o formulário antes de chamar o `AuthService` (campos obrigatórios, e-mail com `@` e domínio, senha com no mínimo 6 caracteres), com o erro em português abaixo de cada campo. Durante o envio, mostra `ActivityIndicator` no botão e o desabilita (um toque duplo não gera dois envios). Erro da API ou falta de conexão aparece em `Alert` e limpa o campo de senha. Fala só com o `AuthService` e, no sucesso, avisa o `App.js` pelo callback `aoAutenticar(usuario)`: a tela não navega sozinha.
