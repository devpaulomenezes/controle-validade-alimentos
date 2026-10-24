/* global describe, it, expect, beforeEach, jest */
/**
 * Testes unitários para JsonProdutoRepository (Issue #6).
 * Valida a persistência em JSON simulando o módulo expo-file-system/legacy em memória.
 */
import repositorio from '../data/JsonProdutoRepository';

import Produto from '../data/Produto';

/**
 * Variável de módulo que simula o sistema de arquivos em memória.
 * No ambiente de testes (Node.js/Jest), o FileSystem nativo do dispositivo não existe
 * e FileSystem.documentDirectory é nulo. Por essa razão, mockamos o módulo
 * expo-file-system/legacy gravando e lendo strings em memória.
 *
 * O prefixo 'mock' é necessário para permitir que a variável seja referenciada
 * dentro da factory hoisted do jest.mock().
 */
const mockArmazenamento = {};
const armazenamento = mockArmazenamento;

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
}));

describe('JsonProdutoRepository', () => {
  beforeEach(() => {
    // Zera o armazenamento em memória antes de cada teste, simulando
    // a primeira execução ou a ausência inicial do arquivo produtos.json.
    for (const chave of Object.keys(armazenamento)) {
      delete armazenamento[chave];
    }
  });

  it('deve resolver listar() como lista vazia [] sem lançar erro quando o arquivo não existir', async () => {
    const produtos = await repositorio.listar();
    expect(produtos).toEqual([]);
  });

  it('deve executar o fluxo CRUD completo mantendo a persistência a cada passo', async () => {
    // 1. Salvar produto sem id pré-definido
    const produtoSemId = new Produto({
      id: null,
      nome: 'Feijão Carioca',
      quantidade: 2,
      dataDeValidade: '2026-11-20',
      fotoUri: null,
      dataDeCadastro: '2026-10-24',
    });

    await repositorio.salvar(produtoSemId);

    // Verifica se listar() retorna 1 produto e se o id foi gerado automaticamente
    const produtosAposSalvar = await repositorio.listar();
    expect(produtosAposSalvar).toHaveLength(1);

    const produtoSalvo = produtosAposSalvar[0];
    expect(produtoSalvo.id).toBeTruthy();
    expect(typeof produtoSalvo.id).toBe('string');
    expect(produtoSalvo.nome).toBe('Feijão Carioca');
    expect(produtoSalvo.quantidade).toBe(2);
    expect(produtoSalvo.dataDeValidade).toBe('2026-11-20');
    expect(produtoSalvo.fotoUri).toBeNull();
    expect(produtoSalvo.dataDeCadastro).toBe('2026-10-24');

    // Verifica se buscarPorId(id) retorna o produto com os mesmos dados
    const produtoBuscado = await repositorio.buscarPorId(produtoSalvo.id);
    expect(produtoBuscado).toEqual(produtoSalvo);

    // 2. Atualizar produto com mesmo id e nome/quantidade alterados
    const produtoModificado = new Produto({
      ...produtoSalvo,
      nome: 'Feijão Preto',
      quantidade: 5,
    });

    await repositorio.atualizar(produtoModificado);

    // Verifica se listar() continua com 1 produto e reflete os dados novos
    const produtosAposAtualizar = await repositorio.listar();
    expect(produtosAposAtualizar).toHaveLength(1);
    expect(produtosAposAtualizar[0].nome).toBe('Feijão Preto');
    expect(produtosAposAtualizar[0].quantidade).toBe(5);

    // Verifica se buscarPorId reflete as alterações
    const produtoBuscadoAposAtualizar = await repositorio.buscarPorId(produtoSalvo.id);
    expect(produtoBuscadoAposAtualizar.nome).toBe('Feijão Preto');
    expect(produtoBuscadoAposAtualizar.quantidade).toBe(5);

    // 3. Remover produto pelo id
    await repositorio.remover(produtoSalvo.id);

    // Verifica se listar() retorna lista vazia e buscarPorId retorna null
    const produtosAposRemover = await repositorio.listar();
    expect(produtosAposRemover).toEqual([]);

    const produtoBuscadoAposRemover = await repositorio.buscarPorId(produtoSalvo.id);
    expect(produtoBuscadoAposRemover).toBeNull();
  });
});
