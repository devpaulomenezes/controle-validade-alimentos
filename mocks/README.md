Mocks TEMPORÁRIOS do bloco de interface (issues #8 e #9), seguindo o contrato da issue #1.
Toda esta pasta é removida na issue #10, quando as telas passam a usar o
JsonProdutoRepository (#3), o ServicoValidade (#4) e o ServicoDashboard (#5) reais.

- `MockProdutoRepository.js` — implementação em memória do `ProdutoRepository` (Singleton).
