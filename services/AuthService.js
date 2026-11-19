/**
 * AuthService (APP-02) — autenticação contra a API e sessão local.
 * A sessão fica em sessao.json ({ token, usuario: { id, nome, email } }) na
 * pasta de documentos do app. Leituras da sessão NÃO fazem requisição de rede.
 */
import * as FileSystem from 'expo-file-system/legacy';

const CAMINHO_SESSAO = `${FileSystem.documentDirectory}sessao.json`;

class AuthService {
  _baseUrl() {
    const base = process.env.EXPO_PUBLIC_API_URL;
    if (!base) {
      throw new Error('URL da API não configurada. Defina EXPO_PUBLIC_API_URL.');
    }
    return String(base).replace(/\/+$/, '');
  }

  async _post(caminho, corpo) {
    const url = `${this._baseUrl()}${caminho}`;
    try {
      return await globalThis.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
    } catch {
      throw new Error('Falha de conexão com o servidor. Verifique sua internet.');
    }
  }

  async _lerJson(resposta) {
    try {
      return await resposta.json();
    } catch {
      throw new Error('Resposta inválida do servidor.');
    }
  }

  async _gravarSessao(dados) {
    const usuario = dados?.usuario ?? {};
    const sessao = {
      token: dados?.token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
    };
    if (!sessao.token) throw new Error('Resposta inválida do servidor.');
    await FileSystem.writeAsStringAsync(CAMINHO_SESSAO, JSON.stringify(sessao));
    return sessao;
  }

  async login(email, senha) {
    const resposta = await this._post('/auth/login', { email, senha });
    if (resposta.status === 401) throw new Error('Credenciais inválidas.');
    if (!resposta.ok) throw new Error(`Erro do servidor (status ${resposta.status}).`);
    return this._gravarSessao(await this._lerJson(resposta));
  }

  async registrar(nome, email, senha) {
    const resposta = await this._post('/auth/registro', { nome, email, senha });
    if (resposta.status === 409) {
      const dados = await this._lerJson(resposta);
      throw new Error(dados?.mensagem ?? 'E-mail já cadastrado.');
    }
    if (!resposta.ok) throw new Error(`Erro do servidor (status ${resposta.status}).`);
    return this._gravarSessao(await this._lerJson(resposta));
  }

  /** Lê a sessão local. Arquivo ausente ou corrompido devolve null. */
  async obterSessao() {
    try {
      const info = await FileSystem.getInfoAsync(CAMINHO_SESSAO);
      if (!info.exists) return null;
      const conteudo = await FileSystem.readAsStringAsync(CAMINHO_SESSAO);
      const sessao = JSON.parse(conteudo);
      return sessao && typeof sessao === 'object' ? sessao : null;
    } catch {
      return null;
    }
  }

  async obterToken() {
    const sessao = await this.obterSessao();
    return sessao?.token ?? null;
  }

  async obterUsuarioId() {
    const sessao = await this.obterSessao();
    return sessao?.usuario?.id ?? null;
  }

  /** Remove a sessão local. Idempotente: sem arquivo, não faz nada. */
  async logout() {
    await FileSystem.deleteAsync(CAMINHO_SESSAO, { idempotent: true });
  }
}

export default new AuthService();
