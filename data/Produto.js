export default class Produto {
  /**
   * @param {Object} params
   * @param {string} params.id - Identificador único do produto.
   * @param {string} params.nome - Nome do produto.
   * @param {number} params.quantidade - Quantidade em estoque.
   * @param {string} params.dataDeValidade - Data de validade em ISO 8601
   *   (YYYY-MM-DD). Persiste como string porque os dados ficam em JSON.
   * @param {string|null} params.fotoUri - URI local da foto do
   *   produto/rótulo (preenchida pela câmera em issue futura; null se não houver).
   * @param {string} params.dataDeCadastro - Data de cadastro em ISO 8601.
   */
  constructor({ id, nome, quantidade, dataDeValidade, fotoUri, dataDeCadastro }) {
    this.id = id;
    this.nome = nome;
    this.quantidade = quantidade;
    this.dataDeValidade = dataDeValidade;
    this.fotoUri = fotoUri;
    this.dataDeCadastro = dataDeCadastro;
  }
}
