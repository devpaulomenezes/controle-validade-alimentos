Telas do aplicativo (navegação via React Navigation).

- `TelaInicial.js` — painel "vencendo esta semana", listagem de produtos com busca por nome, filtro por situação e remoção.
- `TelaCadastro.js` — formulário de cadastro com date picker e foto; salva no `JsonProdutoRepository` e agenda o alerta de vencimento.
- `TelaDetalhe.js` — foto, situação, dias restantes e data de cadastro; edição e remoção.
- `TelaLogin.js` (APP-06) — login e criação de conta, alternados por um botão. Valida o formulário antes de chamar o `AuthService` (campos obrigatórios, e-mail com `@` e domínio, senha com no mínimo 6 caracteres), com o erro em português abaixo de cada campo. Durante o envio, mostra `ActivityIndicator` no botão e o desabilita (um toque duplo não gera dois envios). Erro da API ou falta de conexão aparece em `Alert` e limpa o campo de senha. Fala só com o `AuthService` e, no sucesso, avisa o `App.js` pelo callback `aoAutenticar(usuario)`: a tela não navega sozinha, pois a escolha da stack é do `App.js` (APP-07).
