/* global describe, it, expect, beforeEach, afterEach, jest */
/**
 * Testes unitários para FilaSincronizacao (APP-03).
 * Simula expo-file-system/legacy com um sistema de arquivos em memória.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { FilaSincronizacao } from '../data/FilaSincronizacao';

const mockArmazenamento = {};

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/documentos-teste/',
  getInfoAsync: jest.fn(async (caminho) => ({
    exists: Object.prototype.hasOwnProperty.call(mockArmazenamento, caminho),
  })),
  readAsStringAsync: jest.fn(async (caminho) => {
    if (!Object.prototype.hasOwnProperty.call(mockArmazenamento, caminho)) {
      throw new Error(`Arquivo não encontrado: ${caminho}`);
    }
    return mockArmazenamento[caminho];
  }),
  writeAsStringAsync: jest.fn(async (caminho, conteudo) => {
    mockArmazenamento[caminho] = conteudo;
  }),
  moveAsync: jest.fn(async ({ from, to }) => {
    mockArmazenamento[to] = mockArmazenamento[from];
    delete mockArmazenamento[from];
  }),
}));

const ARQUIVO = '/documentos-teste/fila_sincronizacao.json';
const TEMP = '/documentos-teste/fila_sincronizacao.tmp.json';

const op = (produtoId, tipo = 'CRIAR') => ({
  tipo,
  produtoId,
  payload: { nome: `Produto ${produtoId}` },
  usuarioId: 'u1',
});

describe('FilaSincronizacao', () => {
  let fila;

  beforeEach(() => {
    for (const chave of Object.keys(mockArmazenamento)) delete mockArmazenamento[chave];
    jest.clearAllMocks();
    fila = new FilaSincronizacao();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retorna [] e quantidade 0 quando o arquivo não existe', async () => {
    expect(await fila.listar()).toEqual([]);
    expect(await fila.quantidade()).toBe(0);
  });

  it('mantém a ordem de inserção (FIFO) com ids únicos e criadoEm ISO', async () => {
    await fila.enfileirar(op('a'));
    await fila.enfileirar(op('b'));
    await fila.enfileirar(op('c'));
    const lista = await fila.listar();
    expect(lista.map((o) => o.produtoId)).toEqual(['a', 'b', 'c']);
    expect(new Set(lista.map((o) => o.idOperacao)).size).toBe(3);
    lista.forEach((o) => {
      expect(new Date(o.criadoEm).toISOString()).toBe(o.criadoEm);
      expect(o.usuarioId).toBe('u1');
      expect(o.payload).toEqual({ nome: `Produto ${o.produtoId}` });
    });
    expect(await fila.quantidade()).toBe(3);
  });

  it('remove apenas a operação informada', async () => {
    await fila.enfileirar(op('a'));
    const b = await fila.enfileirar(op('b'));
    await fila.enfileirar(op('c'));
    await fila.removerOperacao(b.idOperacao);
    expect((await fila.listar()).map((o) => o.produtoId)).toEqual(['a', 'c']);
  });

  it('removerOperacao com id inexistente não altera a fila nem grava', async () => {
    await fila.enfileirar(op('a'));
    FileSystem.writeAsStringAsync.mockClear();
    await fila.removerOperacao('nao-existe');
    expect(await fila.quantidade()).toBe(1);
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('persiste: uma nova instância lê o mesmo arquivo', async () => {
    await fila.enfileirar(op('a'));
    await fila.enfileirar(op('b'));
    const outra = new FilaSincronizacao();
    expect((await outra.listar()).map((o) => o.produtoId)).toEqual(['a', 'b']);
    expect(await outra.quantidade()).toBe(2);
  });

  it('limpar esvazia a fila e persiste', async () => {
    await fila.enfileirar(op('a'));
    await fila.limpar();
    expect(await fila.listar()).toEqual([]);
    expect(await new FilaSincronizacao().quantidade()).toBe(0);
  });

  it('JSON corrompido loga erro e retorna []', async () => {
    mockArmazenamento[ARQUIVO] = '{conteudo inválido';
    const erro = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await fila.listar()).toEqual([]);
    expect(await fila.quantidade()).toBe(0);
    expect(erro).toHaveBeenCalled();
  });

  it('grava de forma atômica: escreve no .tmp antes de mover para o arquivo final', async () => {
    await fila.enfileirar(op('a'));

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(TEMP, expect.any(String));
    expect(FileSystem.moveAsync).toHaveBeenCalledWith({ from: TEMP, to: ARQUIVO });

    const ordemEscrita = FileSystem.writeAsStringAsync.mock.invocationCallOrder[0];
    const ordemMover = FileSystem.moveAsync.mock.invocationCallOrder[0];
    expect(ordemEscrita).toBeLessThan(ordemMover);

    // Nunca escreve direto no arquivo final; o .tmp não sobra após o move.
    const caminhosEscritos = FileSystem.writeAsStringAsync.mock.calls.map((c) => c[0]);
    expect(caminhosEscritos).not.toContain(ARQUIVO);
    expect(mockArmazenamento[TEMP]).toBeUndefined();
  });
});
