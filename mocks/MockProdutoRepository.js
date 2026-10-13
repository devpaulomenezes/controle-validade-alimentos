/**
 * MOCK TEMPORÁRIO — repositório em memória que segue o contrato
 * ProdutoRepository (issue #1). Usado pelas telas do bloco de interface
 * (#8 e #9) até a integração com o JsonProdutoRepository real (#3), feita
 * na issue #10. Os dados se perdem ao recarregar o app.
 */
import ProdutoRepository from '../data/ProdutoRepository';

/** Gera um id único simples, suficiente para os dados mock. */
export function gerarIdMock() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

class MockProdutoRepository extends ProdutoRepository {
  constructor() {
    super();
    this.produtos = [];
  }

  async listar() {
    return [...this.produtos];
  }

  async salvar(produto) {
    this.produtos.push(produto);
    console.log('[MockProdutoRepository] produto salvo:', produto);
  }

  async atualizar(produto) {
    const indice = this.produtos.findIndex((p) => p.id === produto.id);
    if (indice === -1) throw new Error(`Produto ${produto.id} não encontrado`);
    this.produtos[indice] = produto;
  }

  async remover(id) {
    this.produtos = this.produtos.filter((p) => p.id !== id);
  }

  async buscarPorId(id) {
    return this.produtos.find((p) => p.id === id) ?? null;
  }
}

// Instância única (Singleton), como definido na arquitetura do README.
export default new MockProdutoRepository();
