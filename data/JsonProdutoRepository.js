/**
 * REPOSITÓRIO REAL — persistência dos produtos em JSON no FileSystem do
 * dispositivo (issue #3). Implementa o contrato ProdutoRepository (issue #1)
 * estendendo a classe da interface, como faz o mock. Os dados ficam em
 * produtos.json, na pasta de documentos do app, e sobrevivem ao fechar e
 * reabrir o aplicativo. É o repositório usado pelas telas desde a issue #10.
 */
import * as FileSystem from 'expo-file-system/legacy';
import ProdutoRepository from './ProdutoRepository';
import Produto from './Produto';

const CAMINHO_ARQUIVO = `${FileSystem.documentDirectory}produtos.json`;

/** Gera um id único simples para novos produtos. */
function gerarId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Converte o texto bruto do arquivo em uma lista de Produto. */
function interpretarConteudo(conteudo) {
  const dados = JSON.parse(conteudo);
  return dados.map((p) => new Produto(p));
}

/**
 * Exportada também como classe nomeada (APP-04) para permitir criar instâncias
 * nos testes; as telas usam o singleton do export default.
 */
export class JsonProdutoRepository extends ProdutoRepository {
  /**
   * Arquivo inexistente (primeira execução) devolve []. Arquivo existente com
   * erro de leitura ou JSON inválido LANÇA erro explícito — nunca devolve [],
   * para que salvar() não sobrescreva a base existente.
   */
  async listar() {
    const info = await FileSystem.getInfoAsync(CAMINHO_ARQUIVO);
    if (!info.exists) return [];
    try {
      const conteudo = await FileSystem.readAsStringAsync(CAMINHO_ARQUIVO);
      return interpretarConteudo(conteudo);
    } catch (erro) {
      console.error('[JsonProdutoRepository] falha ao ler produtos.json:', erro);
      throw new Error(
        'Não foi possível ler a base de produtos (produtos.json). Os dados existentes foram preservados.'
      );
    }
  }

  /**
   * Gera id e dataDeCadastro quando o produto chega sem eles (a tela não gera).
   * Devolve o produto efetivamente gravado (com o id gerado), para que quem
   * chamou possa vincular o alerta de notificação ao id real (produtoId).
   */
  async salvar(produto) {
    const novo = new Produto({
      ...produto,
      id: produto.id || gerarId(),
      dataDeCadastro: produto.dataDeCadastro || new Date().toISOString(),
    });
    const produtos = await this.listar();
    produtos.push(novo);
    await this.#gravar(produtos);
    return novo;
  }

  async atualizar(produto) {
    const produtos = await this.listar();
    const indice = produtos.findIndex((p) => p.id === produto.id);
    if (indice === -1) throw new Error(`Produto ${produto.id} não encontrado`);
    produtos[indice] = produto;
    await this.#gravar(produtos);
  }

  async remover(id) {
    const produtos = await this.listar();
    const restantes = produtos.filter((p) => p.id !== id);
    await this.#gravar(restantes);
  }

  async buscarPorId(id) {
    const produtos = await this.listar();
    return produtos.find((p) => p.id === id) ?? null;
  }

  /**
   * Substitui todo o conteúdo de produtos.json pela lista recebida (APP-04).
   * Usado só pelo OfflineFirstProdutoRepository (APP-05), com a fila do
   * usuário vazia, para espelhar a base do servidor — as telas não chamam.
   * Cada item vira um Produto (campos fora do contrato, como o usuarioId da
   * API, são descartados). Um valor que não é lista lança erro e preserva a base.
   *
   * @param {Array<Object>} produtos - Lista completa que passa a ser o cache local.
   * @returns {Promise<void>}
   */
  async substituirTodos(produtos) {
    if (!Array.isArray(produtos)) {
      throw new Error('substituirTodos() espera uma lista de produtos.');
    }
    await this.#gravar(produtos.map((p) => new Produto(p)));
  }

  /**
   * Remove o conteúdo de produtos.json, gravando uma lista vazia (APP-04).
   * Usado no logout (APP-07), para um usuário não ver os produtos do anterior.
   * Idempotente: sem arquivo existente, apenas cria a base vazia, sem erro.
   * Falha de gravação é propagada (como em salvar/atualizar/remover).
   *
   * @returns {Promise<void>}
   */
  async limpar() {
    await this.#gravar([]);
  }

  async #gravar(produtos) {
    try {
      await FileSystem.writeAsStringAsync(CAMINHO_ARQUIVO, JSON.stringify(produtos));
    } catch (erro) {
      console.error('[JsonProdutoRepository] falha ao gravar produtos.json:', erro);
      throw erro;
    }
  }
}

// Instância única (Singleton), como definido na arquitetura do README.
export default new JsonProdutoRepository();
