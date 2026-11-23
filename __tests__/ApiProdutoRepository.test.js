/* global describe, it, expect, jest */
import { ApiProdutoRepository } from '../data/ApiProdutoRepository';
import ProdutoRepository from '../data/ProdutoRepository';
import Produto from '../data/Produto';

const resp = (status, corpo) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => corpo,
});

const bruto = {
  id: '1',
  nome: 'Leite',
  quantidade: '3',
  dataDeValidade: '2026-12-01',
  fotoUri: null,
  dataDeCadastro: '2026-11-01',
};

function criar(resposta, extra = {}) {
  const fetchImpl = jest.fn().mockResolvedValue(resposta);
  const repo = new ApiProdutoRepository({
    baseUrl: 'http://api.teste/',
    fetchImpl,
    ...extra,
  });
  return { repo, fetchImpl };
}

describe('ApiProdutoRepository', () => {
  it('estende ProdutoRepository', () => {
    expect(new ApiProdutoRepository({ baseUrl: 'x' })).toBeInstanceOf(
      ProdutoRepository
    );
  });

  it('usa EXPO_PUBLIC_API_URL como baseUrl padrão', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://env.teste';
    expect(new ApiProdutoRepository().baseUrl).toBe('http://env.teste');
    delete process.env.EXPO_PUBLIC_API_URL;
  });

  it('falha em português sem baseUrl', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const fetchImpl = jest.fn();
    const repo = new ApiProdutoRepository({ fetchImpl });
    await expect(repo.listar()).rejects.toThrow('URL da API não configurada');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  describe('listar', () => {
    it('retorna instâncias de Produto com quantidade numérica', async () => {
      const { repo, fetchImpl } = criar(resp(200, [bruto]));
      const lista = await repo.listar();
      expect(fetchImpl.mock.calls[0][0]).toBe('http://api.teste/produtos');
      expect(fetchImpl.mock.calls[0][1].method).toBe('GET');
      expect(lista[0]).toBeInstanceOf(Produto);
      expect(lista[0].quantidade).toBe(3);
      expect(typeof lista[0].dataDeValidade).toBe('string');
    });

    it('lança erro em português com status >= 400', async () => {
      const { repo } = criar(resp(500, {}));
      await expect(repo.listar()).rejects.toThrow('Erro do servidor (status 500)');
    });

    it('lança erro em português em falha de rede', async () => {
      const fetchImpl = jest.fn().mockRejectedValue(new Error('network'));
      const repo = new ApiProdutoRepository({ baseUrl: 'http://a', fetchImpl });
      await expect(repo.listar()).rejects.toThrow('Falha de conexão');
    });
  });

  describe('buscarPorId', () => {
    it('retorna Produto', async () => {
      const { repo, fetchImpl } = criar(resp(200, bruto));
      const p = await repo.buscarPorId('1');
      expect(fetchImpl.mock.calls[0][0]).toBe('http://api.teste/produtos/1');
      expect(p).toBeInstanceOf(Produto);
      expect(p.quantidade).toBe(3);
    });

    it('retorna null em 404', async () => {
      const { repo } = criar(resp(404, {}));
      await expect(repo.buscarPorId('x')).resolves.toBeNull();
    });

    it('propaga erro de servidor', async () => {
      const { repo } = criar(resp(500, {}));
      await expect(repo.buscarPorId('1')).rejects.toThrow('Erro do servidor');
    });
  });

  describe('salvar', () => {
    it('envia POST com o corpo JSON', async () => {
      const { repo, fetchImpl } = criar(resp(201, bruto));
      await repo.salvar(new Produto({ ...bruto, quantidade: 3 }));
      const [url, op] = fetchImpl.mock.calls[0];
      expect(url).toBe('http://api.teste/produtos');
      expect(op.method).toBe('POST');
      expect(JSON.parse(op.body).nome).toBe('Leite');
    });

    it('propaga erro 400', async () => {
      const { repo } = criar(resp(400, {}));
      await expect(repo.salvar(bruto)).rejects.toThrow('status 400');
    });
  });

  describe('atualizar', () => {
    it('envia PUT', async () => {
      const { repo, fetchImpl } = criar(resp(200, bruto));
      await repo.atualizar(bruto);
      const [url, op] = fetchImpl.mock.calls[0];
      expect(url).toBe('http://api.teste/produtos/1');
      expect(op.method).toBe('PUT');
    });

    it('lança erro em 404', async () => {
      const { repo } = criar(resp(404, {}));
      await expect(repo.atualizar(bruto)).rejects.toThrow('não encontrado');
    });

    it('propaga erro 500', async () => {
      const { repo } = criar(resp(500, {}));
      await expect(repo.atualizar(bruto)).rejects.toThrow('status 500');
    });
  });

  describe('remover', () => {
    it('envia DELETE', async () => {
      const { repo, fetchImpl } = criar(resp(204));
      await expect(repo.remover('1')).resolves.toBeUndefined();
      expect(fetchImpl.mock.calls[0][1].method).toBe('DELETE');
    });

    it('não lança erro em 404 (idempotente)', async () => {
      const { repo } = criar(resp(404, {}));
      await expect(repo.remover('1')).resolves.toBeUndefined();
    });

    it('propaga erro 500', async () => {
      const { repo } = criar(resp(500, {}));
      await expect(repo.remover('1')).rejects.toThrow('status 500');
    });
  });

  describe('cabeçalhos e token', () => {
    it('sempre envia Content-Type e omite Authorization sem token', async () => {
      const { repo, fetchImpl } = criar(resp(200, []));
      await repo.listar();
      const h = fetchImpl.mock.calls[0][1].headers;
      expect(h['Content-Type']).toBe('application/json');
      expect(h.Authorization).toBeUndefined();
    });

    it('omite Authorization quando obterToken retorna null', async () => {
      const { repo, fetchImpl } = criar(resp(200, []), {
        obterToken: () => null,
      });
      await repo.listar();
      expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
    });

    it('envia Bearer e lê o token a cada requisição', async () => {
      const obterToken = jest
        .fn()
        .mockResolvedValueOnce('abc')
        .mockResolvedValueOnce('def');
      const { repo, fetchImpl } = criar(resp(200, []), { obterToken });
      await repo.listar();
      await repo.listar();
      expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer abc');
      expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer def');
      expect(obterToken).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(repo)).not.toContain('abc');
    });
  });
});
