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

## FilaSincronizacao (APP-03, Etapa 2)

Fila FIFO de operações pendentes de sincronização, persistida em `fila_sincronizacao.json` (pasta de documentos do app, via `expo-file-system/legacy`). Exporta um singleton padrão e a classe nomeada `FilaSincronizacao`.

- **Gravação atômica:** escreve em `fila_sincronizacao.tmp.json` e usa `moveAsync` para sobrescrever `fila_sincronizacao.json`.
- `listar()`: retorna a lista; arquivo inexistente ou JSON corrompido (logado com `console.error`) retorna `[]`.
- `enfileirar({ tipo, produtoId, payload, usuarioId })`: gera `idOperacao` único (Date + Math.random + contador) e `criadoEm` (ISO 8601), adiciona ao final e salva. Retorna a operação.
- `removerOperacao(idOperacao)`: remove o item; se não existir, não faz nada.
- `quantidade()`: tamanho da fila (0 se não existir).
- `limpar()`: esvazia a fila e salva.

## JsonProdutoRepository: `substituirTodos` e `limpar` (APP-04, Etapa 2)

Dois métodos novos no cache local, usados pelo `OfflineFirstProdutoRepository` (APP-05). As telas não os chamam.

- `substituirTodos(produtos)`: grava a lista recebida como substituto completo de `produtos.json`. Cada item é convertido em `Produto`, então campos fora do contrato (como o `usuarioId` devolvido pela API) não são gravados. Só deve ser usado com a fila do usuário vazia (regra da APP-05), para não apagar alterações offline ainda não enviadas. Um valor que não é lista lança erro e preserva a base.
- `limpar()`: grava uma lista vazia em `produtos.json` (logout, APP-07), para um usuário não ver os produtos do anterior. É idempotente: sem arquivo existente, só cria a base vazia, sem erro. Falha de gravação é propagada, como em `salvar`/`atualizar`/`remover`.
- Além do singleton (`export default new JsonProdutoRepository()`), a classe é exportada com nome (`export class JsonProdutoRepository`), para criar instâncias nos testes. Todas as instâncias usam o mesmo arquivo `produtos.json`.

## OfflineFirstProdutoRepository (APP-05, Etapa 2)

Implementa `ProdutoRepository` coordenando o cache local (`JsonProdutoRepository`), a fila offline (`FilaSincronizacao`) e a API (`ApiProdutoRepository`). Exporta o singleton padrão e a classe nomeada. O construtor recebe `{ localRepo, remotoRepo, fila, obterUsuarioId }`: os padrões são as implementações reais (`obterUsuarioId` lê a sessão local via `AuthService`), e os testes injetam fakes.

- **Escritas** (`salvar`, `atualizar`, `remover`): gravam primeiro no cache local, enfileiram a operação (`SALVAR`, `ATUALIZAR` ou `REMOVER`) com o `usuarioId` e disparam `sincronizar()` em segundo plano. A tela nunca espera a rede. Falha ao enfileirar é registrada no console e não é lançada, pois a escrita local já valeu.
- **Leituras** (`listar`, `buscarPorId`): chamam `sincronizar()` (ignorando falhas de rede) e devolvem sempre o cache local.
- **`sincronizar()`** devolve `{ sessaoExpirada }`:
  - Processa só os itens do usuário atual, em ordem (FIFO). Cada item enviado sai da fila na hora, então uma falha no meio não reenvia os anteriores: a próxima execução retoma do item que falhou.
  - Sem conexão ou status `5xx`: interrompe e mantém o item e os seguintes. Status `401`: interrompe, mantém a fila e devolve `sessaoExpirada: true` (a tela pede novo login, na APP-07). Outro `4xx`: descarta o item, registra no console e segue com os próximos.
  - Mapeamento para a API: `SALVAR` → `remotoRepo.salvar(payload)`, `ATUALIZAR` → `remotoRepo.atualizar(payload)`, `REMOVER` → `remotoRepo.remover(produtoId)` (o mesmo `id` gerado no cliente).
  - Com a fila do usuário vazia, busca `remotoRepo.listar()` e chama `localRepo.substituirTodos(remotos)`. Antes de substituir, confere a fila de novo: uma escrita feita durante o download é enviada primeiro, para não ser apagada do cache. Itens de outros usuários na fila nunca são enviados nem removidos.
  - Trava em memória: chamadas simultâneas recebem a mesma promessa (o mesmo resultado), sem enviar nenhum item duas vezes. A trava é liberada ao terminar, com sucesso ou com erro.
- O status HTTP é lido da mensagem de erro do `ApiProdutoRepository` (`Erro do servidor (status N).`; `... não encontrado ...` conta como 404). Erro sem status conhecido é tratado como falha de conexão: transitório, nunca descarta dados.
