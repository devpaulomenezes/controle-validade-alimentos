/**
 * FILA DE SINCRONIZAÇÃO (APP-03, Etapa 2) — fila FIFO de operações pendentes
 * persistida em fila_sincronizacao.json no FileSystem do dispositivo.
 * A gravação é atômica: escreve em fila_sincronizacao.tmp.json e move o
 * arquivo temporário sobre o definitivo.
 */
import * as FileSystem from 'expo-file-system/legacy';

const CAMINHO_ARQUIVO = `${FileSystem.documentDirectory}fila_sincronizacao.json`;
const CAMINHO_TEMPORARIO = `${FileSystem.documentDirectory}fila_sincronizacao.tmp.json`;

export class FilaSincronizacao {
  #contador = 0;

  /** Gera id único sem libs: Date + Math.random + contador interno. */
  #gerarIdOperacao() {
    this.#contador += 1;
    const aleatorio = Math.random().toString(36).slice(2, 8);
    return `${Date.now().toString(36)}-${aleatorio}-${this.#contador.toString(36)}`;
  }

  /**
   * Arquivo inexistente ou JSON corrompido devolvem [] (corrupção é logada).
   */
  async listar() {
    const info = await FileSystem.getInfoAsync(CAMINHO_ARQUIVO);
    if (!info.exists) return [];
    try {
      const conteudo = await FileSystem.readAsStringAsync(CAMINHO_ARQUIVO);
      const dados = JSON.parse(conteudo);
      if (!Array.isArray(dados)) throw new Error('Conteúdo da fila não é uma lista');
      return dados;
    } catch (erro) {
      console.error('[FilaSincronizacao] falha ao ler fila_sincronizacao.json:', erro);
      return [];
    }
  }

  /** Adiciona uma operação ao final da fila e persiste. Devolve a operação. */
  async enfileirar({ tipo, produtoId, payload, usuarioId }) {
    const operacao = {
      idOperacao: this.#gerarIdOperacao(),
      tipo,
      produtoId,
      payload,
      usuarioId,
      criadoEm: new Date().toISOString(),
    };
    const fila = await this.listar();
    fila.push(operacao);
    await this.#gravar(fila);
    return operacao;
  }

  /** Remove a operação pelo id. Se não existir, não faz nada. */
  async removerOperacao(idOperacao) {
    const fila = await this.listar();
    const restantes = fila.filter((op) => op.idOperacao !== idOperacao);
    if (restantes.length === fila.length) return;
    await this.#gravar(restantes);
  }

  async quantidade() {
    const fila = await this.listar();
    return fila.length;
  }

  async limpar() {
    await this.#gravar([]);
  }

  /** Gravação atômica: escreve no .tmp.json e move sobre o arquivo final. */
  async #gravar(fila) {
    try {
      await FileSystem.writeAsStringAsync(CAMINHO_TEMPORARIO, JSON.stringify(fila));
      await FileSystem.moveAsync({ from: CAMINHO_TEMPORARIO, to: CAMINHO_ARQUIVO });
    } catch (erro) {
      console.error('[FilaSincronizacao] falha ao gravar fila_sincronizacao.json:', erro);
      throw erro;
    }
  }
}

// Instância única (Singleton), como definido na arquitetura do README.
export default new FilaSincronizacao();
