/**
 * OfflineFirstProdutoRepository (APP-05, Etapa 2) — coordena três fontes:
 * o cache local (JsonProdutoRepository), a fila offline (FilaSincronizacao)
 * e a API remota (ApiProdutoRepository). Implementa o contrato
 * ProdutoRepository: as telas continuam usando listar/salvar/atualizar/
 * remover/buscarPorId normalmente, sem saber que existe sincronização.
 *
 * - Escritas gravam primeiro no cache local, enfileiram a operação e disparam
 *   sincronizar() em segundo plano: a tela nunca espera a rede.
 * - Leituras sincronizam antes (ignorando falhas de rede) e sempre devolvem
 *   o cache local.
 */
import ProdutoRepository from './ProdutoRepository';
import jsonProdutoRepositorio from './JsonProdutoRepository';
import { ApiProdutoRepository } from './ApiProdutoRepository';
import filaSincronizacao from './FilaSincronizacao';
import AuthService from '../services/AuthService';

const MENSAGEM_FALHA_DE_CONEXAO = 'Falha de conexão com o servidor. Verifique sua internet.';

/**
 * Classifica o erro lançado pelo remotoRepo em: 'rede' (sem conexão ou status
 * desconhecido — tratado como transitório, nunca descarta dados do usuário),
 * 401, ou um número de status 4xx/5xx. ApiProdutoRepository não anexa um
 * campo .status ao erro; por isso o status é lido da própria mensagem quando
 * presente, e um eventual erro.status numérico (útil nos testes) tem prioridade.
 */
function interpretarErro(erro) {
  if (typeof erro?.status === 'number') return erro.status;
  const mensagem = erro?.message || '';
  if (mensagem === MENSAGEM_FALHA_DE_CONEXAO) return 'rede';
  if (/não encontrad[oa]/i.test(mensagem)) return 404;
  const combinado = mensagem.match(/status (\d{3})/);
  if (combinado) return Number(combinado[1]);
  return 'rede';
}

export class OfflineFirstProdutoRepository extends ProdutoRepository {
  /** Promessa da sincronização em andamento (trava em memória); null quando livre. */
  #sincronizacaoEmAndamento = null;

  /**
   * Os valores padrão apontam para as implementações reais; os testes injetam mocks.
   *
   * @param {Object} [dependencias]
   * @param {ProdutoRepository} [dependencias.localRepo] - Cache local (precisa de substituirTodos).
   * @param {ProdutoRepository} [dependencias.remotoRepo] - API remota.
   * @param {{ listar: Function, enfileirar: Function, removerOperacao: Function }} [dependencias.fila] - Fila offline.
   * @param {() => Promise<string|null>} [dependencias.obterUsuarioId] - Usuário da sessão atual.
   */
  constructor({ localRepo, remotoRepo, fila, obterUsuarioId } = {}) {
    super();
    this.localRepo = localRepo ?? jsonProdutoRepositorio;
    this.remotoRepo =
      remotoRepo ?? new ApiProdutoRepository({ obterToken: () => AuthService.obterToken() });
    this.fila = fila ?? filaSincronizacao;
    this.obterUsuarioId = obterUsuarioId ?? (() => AuthService.obterUsuarioId());
  }

  async listar() {
    await this.sincronizar().catch(() => {});
    return this.localRepo.listar();
  }

  async buscarPorId(id) {
    await this.sincronizar().catch(() => {});
    return this.localRepo.buscarPorId(id);
  }

  async salvar(produto) {
    const salvo = await this.localRepo.salvar(produto);
    await this.#enfileirarEEnviar({ tipo: 'SALVAR', produtoId: salvo.id, payload: salvo });
    return salvo;
  }

  async atualizar(produto) {
    await this.localRepo.atualizar(produto);
    await this.#enfileirarEEnviar({ tipo: 'ATUALIZAR', produtoId: produto.id, payload: produto });
  }

  async remover(id) {
    await this.localRepo.remover(id);
    await this.#enfileirarEEnviar({ tipo: 'REMOVER', produtoId: id, payload: null });
  }

  /**
   * Envia a fila do usuário atual e, com ela vazia, espelha a base do servidor
   * no cache local. Devolve { sessaoExpirada } — true quando o servidor
   * respondeu 401 (a tela decide pedir novo login, APP-07).
   *
   * Trava em memória: chamadas feitas enquanto uma sincronização está em
   * andamento recebem a MESMA promessa (mesmo resultado), em vez de iniciar
   * outra — assim nenhum item é enviado duas vezes. A trava é liberada ao
   * terminar, com sucesso ou com erro.
   *
   * @returns {Promise<{ sessaoExpirada: boolean }>}
   */
  sincronizar() {
    if (!this.#sincronizacaoEmAndamento) {
      this.#sincronizacaoEmAndamento = this.#executarSincronizacao().finally(() => {
        this.#sincronizacaoEmAndamento = null;
      });
    }
    return this.#sincronizacaoEmAndamento;
  }

  /**
   * Enfileira a operação e dispara sincronizar() em segundo plano, sem
   * esperar a rede. Nunca lança: só o localRepo (já gravado por quem chamou,
   * antes desta função) decide se a escrita teve sucesso para a tela —
   * enfileirar e sincronizar são melhor-esforço.
   */
  async #enfileirarEEnviar({ tipo, produtoId, payload }) {
    try {
      const usuarioId = await this.obterUsuarioId();
      await this.fila.enfileirar({ tipo, produtoId, payload, usuarioId });
    } catch (erro) {
      console.error('[OfflineFirstProdutoRepository] falha ao enfileirar a operação:', erro);
      return;
    }
    this.sincronizar().catch((erro) => {
      console.error('[OfflineFirstProdutoRepository] falha ao sincronizar:', erro);
    });
  }

  async #itensPendentes(usuarioId) {
    const filaCompleta = await this.fila.listar();
    return filaCompleta.filter((item) => item.usuarioId === usuarioId);
  }

  #enviarOperacao(item) {
    if (item.tipo === 'SALVAR') return this.remotoRepo.salvar(item.payload);
    if (item.tipo === 'ATUALIZAR') return this.remotoRepo.atualizar(item.payload);
    if (item.tipo === 'REMOVER') return this.remotoRepo.remover(item.produtoId);
    return Promise.resolve();
  }

  /**
   * Uma rodada de sincronização. Processa só os itens do usuário atual, em
   * ordem (FIFO); cada item enviado sai da fila na hora, então uma falha no
   * meio não reenvia os já processados. Escritas feitas durante a rodada
   * entram no fim da fila e são enviadas nela mesma (a fila é relida).
   */
  async #executarSincronizacao() {
    const usuarioId = await this.obterUsuarioId();
    const processados = new Set();

    for (;;) {
      const pendentes = await this.#itensPendentes(usuarioId);

      if (pendentes.length > 0) {
        for (const item of pendentes) {
          // Item já tratado nesta rodada que continua na fila: para, em vez de repetir.
          if (processados.has(item.idOperacao)) return { sessaoExpirada: false };
          processados.add(item.idOperacao);
          try {
            await this.#enviarOperacao(item);
          } catch (erro) {
            const classificacao = interpretarErro(erro);
            // 401: interrompe e mantém este item e os seguintes; a tela pede novo login.
            if (classificacao === 401) return { sessaoExpirada: true };
            // Sem conexão ou 5xx: interrompe e mantém este item e os seguintes.
            if (classificacao === 'rede' || classificacao >= 500) return { sessaoExpirada: false };
            // Outro 4xx: o servidor rejeitou a operação em definitivo (dado
            // inválido, recurso já removido etc.). Descarta e segue a fila.
            console.error('[OfflineFirstProdutoRepository] operação descartada (erro 4xx):', erro);
          }
          await this.fila.removerOperacao(item.idOperacao);
        }
        continue;
      }

      // Fila do usuário vazia: busca a base do servidor.
      let remotos;
      try {
        remotos = await this.remotoRepo.listar();
      } catch (erro) {
        return { sessaoExpirada: interpretarErro(erro) === 401 };
      }
      // Nunca substitui o cache com pendências: uma escrita feita durante o
      // download seria apagada do cache antes de chegar ao servidor.
      if ((await this.#itensPendentes(usuarioId)).length > 0) continue;
      await this.localRepo.substituirTodos(remotos);
      return { sessaoExpirada: false };
    }
  }
}

export default new OfflineFirstProdutoRepository();
