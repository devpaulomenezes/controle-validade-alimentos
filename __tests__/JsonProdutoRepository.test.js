/* global describe, it, expect, beforeEach, afterEach, jest */
/**
 * Testes unitários para JsonProdutoRepository (Issue #6, ampliados na issue #19).
 * Valida a persistência em JSON simulando o módulo expo-file-system/legacy em memória.
 */
import * as FileSystem from 'expo-file-system/legacy';
import repositorio, { JsonProdutoRepository } from '../data/JsonProdutoRepository';

import Produto from '../data/Produto';
import ProdutoRepository from '../data/ProdutoRepository';

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

  it('deve gerar id e dataDeCadastro quando o produto chegar sem eles (cadastro da issue #10)', async () => {
    await repositorio.salvar(
      new Produto({
        id: null,
        nome: 'Iogurte',
        quantidade: 1,
        dataDeValidade: '2026-11-02',
        fotoUri: null,
        dataDeCadastro: null,
      })
    );

    const [produtoSalvo] = await repositorio.listar();
    expect(typeof produtoSalvo.id).toBe('string');
    expect(produtoSalvo.id).toBeTruthy();
    expect(typeof produtoSalvo.dataDeCadastro).toBe('string');
    expect(Number.isNaN(Date.parse(produtoSalvo.dataDeCadastro))).toBe(false);
  });

  it('salvar() deve devolver o produto gravado, com o id gerado', async () => {
    const salvo = await repositorio.salvar(
      new Produto({
        id: null,
        nome: 'Manteiga',
        quantidade: 1,
        dataDeValidade: '2026-12-01',
        fotoUri: null,
        dataDeCadastro: null,
      })
    );

    const [persistido] = await repositorio.listar();
    expect(salvo.id).toBeTruthy();
    expect(salvo.id).toBe(persistido.id);
  });

  describe('atualizar (issue #19)', () => {
    async function semear() {
      const nomes = ['Leite', 'Arroz', 'Queijo'];
      for (const [i, nome] of nomes.entries()) {
        await repositorio.salvar(
          new Produto({
            id: `id-${i}`,
            nome,
            quantidade: i + 1,
            dataDeValidade: '2026-12-01',
            fotoUri: null,
            dataDeCadastro: `2026-10-0${i + 1}`,
          })
        );
      }
    }

    it('deve substituir o produto pelo id, manter o total de registros e preservar dataDeCadastro', async () => {
      await semear();

      await repositorio.atualizar(
        new Produto({
          id: 'id-1',
          nome: 'Arroz Integral',
          quantidade: 9,
          dataDeValidade: '2027-01-15',
          fotoUri: null,
          dataDeCadastro: '2026-10-02',
        })
      );

      const produtos = await repositorio.listar();
      expect(produtos).toHaveLength(3);
      const editado = produtos.find((p) => p.id === 'id-1');
      expect(editado.nome).toBe('Arroz Integral');
      expect(editado.quantidade).toBe(9);
      expect(editado.dataDeValidade).toBe('2027-01-15');
      expect(editado.dataDeCadastro).toBe('2026-10-02');
      // Os demais registros ficam intactos.
      expect(produtos.find((p) => p.id === 'id-0').nome).toBe('Leite');
      expect(produtos.find((p) => p.id === 'id-2').nome).toBe('Queijo');
    });

    it('deve lançar erro quando o id não existir e não alterar a base', async () => {
      await semear();
      const antes = armazenamento['/documentos-teste/produtos.json'];

      await expect(
        repositorio.atualizar(
          new Produto({
            id: 'inexistente',
            nome: 'Fantasma',
            quantidade: 1,
            dataDeValidade: '2026-12-01',
            fotoUri: null,
            dataDeCadastro: '2026-10-01',
          })
        )
      ).rejects.toThrow(/não encontrado/);

      expect(armazenamento['/documentos-teste/produtos.json']).toBe(antes);
    });
  });

  describe('robustez da persistência (issue #19)', () => {
    const CAMINHO = '/documentos-teste/produtos.json';
    let consoleErro;

    beforeEach(() => {
      // Os erros esperados são registrados no console pelo repositório.
      consoleErro = jest.spyOn(console, 'error').mockImplementation(() => {});
      FileSystem.writeAsStringAsync.mockClear();
    });

    afterEach(() => {
      consoleErro.mockRestore();
    });

    it('listar() deve lançar erro explícito (e não retornar []) quando o arquivo existe com JSON inválido', async () => {
      armazenamento[CAMINHO] = '{ isto não é json';

      await expect(repositorio.listar()).rejects.toThrow(/Não foi possível ler a base de produtos/);
    });

    it('listar() deve lançar erro explícito quando o arquivo existe mas a leitura falha', async () => {
      armazenamento[CAMINHO] = '[]';
      FileSystem.readAsStringAsync.mockRejectedValueOnce(new Error('falha de I/O'));

      await expect(repositorio.listar()).rejects.toThrow(/Não foi possível ler a base de produtos/);
    });

    it('falha de escrita (#gravar) deve propagar a exceção para salvar()', async () => {
      FileSystem.writeAsStringAsync.mockRejectedValueOnce(new Error('disco cheio'));

      await expect(
        repositorio.salvar(
          new Produto({
            id: null,
            nome: 'Sem espaço',
            quantidade: 1,
            dataDeValidade: '2026-12-01',
            fotoUri: null,
            dataDeCadastro: null,
          })
        )
      ).rejects.toThrow('disco cheio');
    });

    it('falha de escrita deve propagar também em atualizar() e remover()', async () => {
      await repositorio.salvar(
        new Produto({
          id: 'x1',
          nome: 'Item',
          quantidade: 1,
          dataDeValidade: '2026-12-01',
          fotoUri: null,
          dataDeCadastro: '2026-10-01',
        })
      );

      FileSystem.writeAsStringAsync.mockRejectedValueOnce(new Error('falha 1'));
      await expect(
        repositorio.atualizar(
          new Produto({
            id: 'x1',
            nome: 'Item 2',
            quantidade: 1,
            dataDeValidade: '2026-12-01',
            fotoUri: null,
            dataDeCadastro: '2026-10-01',
          })
        )
      ).rejects.toThrow('falha 1');

      FileSystem.writeAsStringAsync.mockRejectedValueOnce(new Error('falha 2'));
      await expect(repositorio.remover('x1')).rejects.toThrow('falha 2');
    });

    it('salvar() NÃO deve sobrescrever a base quando listar() falha', async () => {
      const baseCorrompida = '[{"id":"a","nome":"Leite"';
      armazenamento[CAMINHO] = baseCorrompida;

      await expect(
        repositorio.salvar(
          new Produto({
            id: null,
            nome: 'Novo',
            quantidade: 1,
            dataDeValidade: '2026-12-01',
            fotoUri: null,
            dataDeCadastro: null,
          })
        )
      ).rejects.toThrow(/Não foi possível ler a base de produtos/);

      expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
      expect(armazenamento[CAMINHO]).toBe(baseCorrompida);
    });
  });

  describe('substituirTodos e limpar (APP-04)', () => {
    const CAMINHO = '/documentos-teste/produtos.json';

    // Formato devolvido pela API: inclui usuarioId, que não faz parte do contrato.
    const dadosRemotos = [
      {
        id: 'r1',
        nome: 'Leite',
        quantidade: 2,
        dataDeValidade: '2026-12-01',
        fotoUri: null,
        dataDeCadastro: '2026-11-01T10:00:00.000Z',
        usuarioId: 'u1',
      },
      {
        id: 'r2',
        nome: 'Arroz',
        quantidade: 1,
        dataDeValidade: '2027-01-15',
        fotoUri: 'file:///documentos-teste/fotos/arroz.jpg',
        dataDeCadastro: '2026-11-02T10:00:00.000Z',
        usuarioId: 'u1',
      },
    ];

    function produtoLocal(id) {
      return new Produto({
        id,
        nome: `Produto ${id}`,
        quantidade: 1,
        dataDeValidade: '2026-12-10',
        fotoUri: null,
        dataDeCadastro: '2026-11-10T08:00:00.000Z',
      });
    }

    let consoleErro;

    beforeEach(() => {
      consoleErro = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErro.mockRestore();
    });

    it('substituirTodos grava exatamente a lista recebida, convertida em Produto', async () => {
      await repositorio.salvar(produtoLocal('antigo'));

      await repositorio.substituirTodos(dadosRemotos);

      const produtos = await repositorio.listar();
      // Substitui (não acrescenta): o produto antigo some.
      expect(produtos.map((p) => p.id)).toEqual(['r1', 'r2']);
      produtos.forEach((p) => expect(p).toBeInstanceOf(Produto));
      expect(produtos[1]).toEqual(new Produto(dadosRemotos[1]));
      // Gravado já como Produto: campos fora do contrato (usuarioId) ficam de fora.
      const gravado = JSON.parse(armazenamento[CAMINHO]);
      expect(gravado).toEqual(
        dadosRemotos.map(({ id, nome, quantidade, dataDeValidade, fotoUri, dataDeCadastro }) => ({
          id,
          nome,
          quantidade,
          dataDeValidade,
          fotoUri,
          dataDeCadastro,
        }))
      );
    });

    it('substituirTodos([]) grava uma lista vazia, e listar() depois retorna []', async () => {
      await repositorio.salvar(produtoLocal('a'));

      await repositorio.substituirTodos([]);

      expect(armazenamento[CAMINHO]).toBe('[]');
      expect(await repositorio.listar()).toEqual([]);
    });

    it('substituirTodos com um valor que não é lista lança erro e preserva a base', async () => {
      await repositorio.salvar(produtoLocal('a'));
      const antes = armazenamento[CAMINHO];

      await expect(repositorio.substituirTodos(null)).rejects.toThrow(/lista de produtos/);
      await expect(repositorio.substituirTodos({ id: 'x' })).rejects.toThrow(/lista de produtos/);

      expect(armazenamento[CAMINHO]).toBe(antes);
    });

    it('limpar() remove o conteúdo de produtos.json, e listar() depois retorna []', async () => {
      await repositorio.salvar(produtoLocal('a'));
      await repositorio.salvar(produtoLocal('b'));

      await repositorio.limpar();

      expect(armazenamento[CAMINHO]).toBe('[]');
      expect(await repositorio.listar()).toEqual([]);
    });

    it('limpar() é idempotente: sem arquivo existente, não lança erro', async () => {
      expect(Object.prototype.hasOwnProperty.call(armazenamento, CAMINHO)).toBe(false);

      await expect(repositorio.limpar()).resolves.toBeUndefined();
      await expect(repositorio.limpar()).resolves.toBeUndefined();

      expect(await repositorio.listar()).toEqual([]);
    });

    it('limpar() propaga a falha de gravação', async () => {
      await repositorio.salvar(produtoLocal('a'));
      FileSystem.writeAsStringAsync.mockRejectedValueOnce(new Error('disco cheio'));

      await expect(repositorio.limpar()).rejects.toThrow('disco cheio');
      expect(await repositorio.listar()).toHaveLength(1);
    });

    it('exporta a classe nomeada JsonProdutoRepository, e o export default é instância dela', async () => {
      expect(typeof JsonProdutoRepository).toBe('function');
      expect(repositorio).toBeInstanceOf(JsonProdutoRepository);
      expect(repositorio).toBeInstanceOf(ProdutoRepository);

      const instancia = new JsonProdutoRepository();
      expect(instancia).not.toBe(repositorio);
      // Mesma persistência (produtos.json): o que uma grava, a outra lê.
      await instancia.substituirTodos(dadosRemotos);
      expect((await repositorio.listar()).map((p) => p.id)).toEqual(['r1', 'r2']);
    });
  });
});
