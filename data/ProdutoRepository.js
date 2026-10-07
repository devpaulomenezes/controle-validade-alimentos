/**
 * CONTRATO DE DADOS DO GRUPO — interface ProdutoRepository.
 * Todas as telas e serviços acessam os produtos SOMENTE através desta
 * interface. Na Etapa 1, JsonProdutoRepository (issue #3) estende esta
 * classe. Na Etapa 2, ApiProdutoRepository fará o mesmo contra a API remota,
 * sem alterar as telas.
 */
export default class ProdutoRepository {
  /** @returns {Promise<Produto[]>} Lista todos os produtos cadastrados. */
  async listar() { throw new Error('Método não implementado'); }

  /** @param {Produto} produto @returns {Promise<void>} */
  async salvar(produto) { throw new Error('Método não implementado'); }

  /** @param {Produto} produto @returns {Promise<void>} */
  async atualizar(produto) { throw new Error('Método não implementado'); }

  /** @param {string} id @returns {Promise<void>} */
  async remover(id) { throw new Error('Método não implementado'); }

  /** @param {string} id @returns {Promise<Produto|null>} */
  async buscarPorId(id) { throw new Error('Método não implementado'); }
}
