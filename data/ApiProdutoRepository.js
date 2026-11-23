import ProdutoRepository from './ProdutoRepository';
import Produto from './Produto';

/**
 * Implementação de ProdutoRepository contra a API remota (Etapa 2).
 * Recursos: GET/POST /produtos, GET/PUT/DELETE /produtos/:id.
 */
export class ApiProdutoRepository extends ProdutoRepository {
  /**
   * @param {Object} [opcoes]
   * @param {string} [opcoes.baseUrl] - Padrão: process.env.EXPO_PUBLIC_API_URL.
   * @param {() => (string|null|Promise<string|null>)} [opcoes.obterToken] -
   *   Lido a cada requisição; o token nunca é guardado na classe.
   * @param {typeof fetch} [opcoes.fetchImpl] - Padrão: fetch global.
   */
  constructor({ baseUrl, obterToken, fetchImpl } = {}) {
    super();
    this.baseUrl = baseUrl ?? process.env.EXPO_PUBLIC_API_URL;
    this.obterToken = obterToken;
    this.fetchImpl = fetchImpl;
  }

  async _requisitar(metodo, caminho, corpo) {
    if (!this.baseUrl) {
      throw new Error(
        'URL da API não configurada. Defina EXPO_PUBLIC_API_URL.'
      );
    }
    const fetchFn = this.fetchImpl ?? globalThis.fetch;
    const headers = { 'Content-Type': 'application/json' };
    const token = this.obterToken ? await this.obterToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    const opcoes = { method: metodo, headers };
    if (corpo !== undefined) opcoes.body = JSON.stringify(corpo);

    const url = `${String(this.baseUrl).replace(/\/+$/, '')}${caminho}`;
    try {
      return await fetchFn(url, opcoes);
    } catch {
      throw new Error('Falha de conexão com o servidor. Verifique sua internet.');
    }
  }

  _erroStatus(resposta) {
    return new Error(`Erro do servidor (status ${resposta.status}).`);
  }

  async _lerJson(resposta) {
    try {
      return await resposta.json();
    } catch {
      throw new Error('Resposta inválida do servidor.');
    }
  }

  _mapear(dados) {
    return new Produto({ ...dados, quantidade: Number(dados.quantidade) });
  }

  async listar() {
    const resposta = await this._requisitar('GET', '/produtos');
    if (!resposta.ok) throw this._erroStatus(resposta);
    const dados = await this._lerJson(resposta);
    if (!Array.isArray(dados)) throw new Error('Resposta inválida do servidor.');
    return dados.map((d) => this._mapear(d));
  }

  async buscarPorId(id) {
    const resposta = await this._requisitar(
      'GET',
      `/produtos/${encodeURIComponent(id)}`
    );
    if (resposta.status === 404) return null;
    if (!resposta.ok) throw this._erroStatus(resposta);
    return this._mapear(await this._lerJson(resposta));
  }

  async salvar(produto) {
    const resposta = await this._requisitar('POST', '/produtos', produto);
    if (!resposta.ok) throw this._erroStatus(resposta);
  }

  async atualizar(produto) {
    const resposta = await this._requisitar(
      'PUT',
      `/produtos/${encodeURIComponent(produto.id)}`,
      produto
    );
    if (resposta.status === 404) {
      throw new Error('Produto não encontrado para atualização.');
    }
    if (!resposta.ok) throw this._erroStatus(resposta);
  }

  async remover(id) {
    const resposta = await this._requisitar(
      'DELETE',
      `/produtos/${encodeURIComponent(id)}`
    );
    if (resposta.status === 404) return;
    if (!resposta.ok) throw this._erroStatus(resposta);
  }
}

export default new ApiProdutoRepository();
