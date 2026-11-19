Contrato de dados do grupo: modelo Produto e interface ProdutoRepository (implementado por JsonProdutoRepository na Etapa 1).

## ApiProdutoRepository (APP-01, Etapa 2)

Implementação de `ProdutoRepository` contra a API remota (`/produtos`, `/produtos/:id`).

- Construtor: `new ApiProdutoRepository({ baseUrl, obterToken, fetchImpl })` (todos opcionais). O módulo exporta um singleton padrão e a classe nomeada.
- `obterToken`: função que retorna o token (ou `null`); é lida a cada requisição e o token nunca é armazenado. Com token, envia `Authorization: Bearer <token>`; sempre envia `Content-Type: application/json`.
- `404`: `buscarPorId` retorna `null`; `remover` é idempotente (não lança); `atualizar` lança `Error`.
- Falhas de rede ou status >= 400 lançam `Error` com mensagem em português.
- Itens retornados são instâncias de `Produto`, com `quantidade` convertida para `Number` e `dataDeValidade` como string.

### Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | URL base da API (ex.: `https://api.exemplo.com`). Sem fallback para `localhost`/`10.0.2.2`; se ausente, as chamadas lançam erro. |
