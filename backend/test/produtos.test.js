/* global describe, it, expect, beforeEach, jest */
process.env.JWT_SECRET = 'segredo-somente-para-testes';

jest.mock('../src/banco', () => {
  const produtos = [];
  const copiar = (p) => ({ ...p });
  const pool = {
    _produtos: produtos,
    _reiniciar() {
      produtos.length = 0;
    },
    query: jest.fn(async (sql, params) => {
      if (/SELECT 1 FROM produtos WHERE id = \$1 AND "usuarioId" <> \$2/i.test(sql)) {
        const [id, usuarioId] = params;
        const existe = produtos.some((p) => p.id === id && p.usuarioId !== usuarioId);
        return { rows: existe ? [{ '?column?': 1 }] : [], rowCount: existe ? 1 : 0 };
      }
      if (/^\s*SELECT[\s\S]*FROM produtos\s+WHERE "usuarioId" = \$1\s+ORDER BY "dataDeValidade" ASC/i.test(sql)) {
        const [usuarioId] = params;
        const lista = produtos
          .filter((p) => p.usuarioId === usuarioId)
          .sort((a, b) => a.dataDeValidade.localeCompare(b.dataDeValidade))
          .map(copiar);
        return { rows: lista, rowCount: lista.length };
      }
      if (/^\s*SELECT[\s\S]*FROM produtos\s+WHERE id = \$1 AND "usuarioId" = \$2/i.test(sql)) {
        const [id, usuarioId] = params;
        const encontrados = produtos
          .filter((p) => p.id === id && p.usuarioId === usuarioId)
          .map(copiar);
        return { rows: encontrados, rowCount: encontrados.length };
      }
      if (/INSERT INTO produtos/i.test(sql)) {
        const [id, usuarioId, nome, quantidade, dataDeValidade, fotoUri, dataDeCadastro] = params;
        if (produtos.some((p) => p.id === id && p.usuarioId === usuarioId)) {
          return { rows: [], rowCount: 0 };
        }
        const registro = {
          id,
          usuarioId,
          nome,
          quantidade,
          dataDeValidade,
          fotoUri,
          dataDeCadastro,
        };
        produtos.push(registro);
        return { rows: [copiar(registro)], rowCount: 1 };
      }
      if (/UPDATE produtos/i.test(sql)) {
        const [nome, quantidade, dataDeValidade, fotoUri, id, usuarioId] = params;
        const indice = produtos.findIndex((p) => p.id === id && p.usuarioId === usuarioId);
        if (indice === -1) {
          return { rows: [], rowCount: 0 };
        }
        produtos[indice] = {
          ...produtos[indice],
          nome,
          quantidade,
          dataDeValidade,
          fotoUri,
        };
        return { rows: [copiar(produtos[indice])], rowCount: 1 };
      }
      if (/DELETE FROM produtos WHERE id = \$1 AND "usuarioId" = \$2/i.test(sql)) {
        const [id, usuarioId] = params;
        const indice = produtos.findIndex((p) => p.id === id && p.usuarioId === usuarioId);
        if (indice === -1) {
          return { rows: [], rowCount: 0 };
        }
        produtos.splice(indice, 1);
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Consulta não prevista no mock: ${sql}`);
    }),
  };
  return { pool, inicializarBanco: jest.fn(async () => {}) };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../src/app');
const { pool } = require('../src/banco');

const SEGREDO = process.env.JWT_SECRET;
const tokenDe = (usuarioId) => jwt.sign({ id: usuarioId }, SEGREDO, { expiresIn: '30d' });
const TOKEN_U1 = tokenDe(1);
const TOKEN_U2 = tokenDe(2);

const PRODUTO_VALIDO = {
  nome: 'Leite',
  quantidade: 2,
  dataDeValidade: '2026-12-31',
};

describe('Produtos (BE-03)', () => {
  beforeEach(() => {
    pool._reiniciar();
    jest.clearAllMocks();
  });

  describe('autenticação obrigatória', () => {
    it('todas as rotas sem token devolvem 401 sem acessar o banco', async () => {
      const respostas = await Promise.all([
        request(app).get('/produtos'),
        request(app).get('/produtos/p1'),
        request(app).post('/produtos').send(PRODUTO_VALIDO),
        request(app).put('/produtos/p1').send(PRODUTO_VALIDO),
        request(app).delete('/produtos/p1'),
      ]);

      for (const res of respostas) {
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ mensagem: 'Token não informado.' });
      }
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('POST /produtos', () => {
    it('cria produto com 201 gerando id e dataDeCadastro quando ausentes', async () => {
      const res = await request(app)
        .post('/produtos')
        .set('Authorization', `Bearer ${TOKEN_U1}`)
        .send({ ...PRODUTO_VALIDO, nome: '  Leite Integral  ', fotoUri: '' });

      expect(res.status).toBe(201);
      expect(typeof res.body.id).toBe('string');
      expect(res.body.id.length).toBeGreaterThan(0);
      expect(res.body.usuarioId).toBe(1);
      expect(res.body.nome).toBe('Leite Integral');
      expect(res.body.quantidade).toBe(2);
      expect(res.body.dataDeValidade).toBe('2026-12-31');
      expect(res.body.fotoUri).toBeNull();
      expect(Number.isNaN(Date.parse(res.body.dataDeCadastro))).toBe(false);
    });

    it('aceita produto com data de validade já vencida e normaliza dataDeCadastro com offset', async () => {
      const res = await request(app)
        .post('/produtos')
        .set('Authorization', `Bearer ${TOKEN_U1}`)
        .send({
          id: '  prod-vencido  ',
          nome: 'Iogurte',
          quantidade: 1,
          dataDeValidade: '2020-01-15',
          fotoUri: 'file:///foto.jpg',
          dataDeCadastro: '2026-11-19T14:00:00-03:00',
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: 'prod-vencido',
        usuarioId: 1,
        nome: 'Iogurte',
        quantidade: 1,
        dataDeValidade: '2020-01-15',
        fotoUri: 'file:///foto.jpg',
        dataDeCadastro: '2026-11-19T17:00:00.000Z',
      });
    });

    it('POST com id existente do mesmo usuário devolve 200 sem duplicar nem alterar campos', async () => {
      const primeiro = await request(app)
        .post('/produtos')
        .set('Authorization', `Bearer ${TOKEN_U1}`)
        .send({ ...PRODUTO_VALIDO, id: 'dup-1', nome: 'Arroz' });
      expect(primeiro.status).toBe(201);

      const segundo = await request(app)
        .post('/produtos')
        .set('Authorization', `Bearer ${TOKEN_U1}`)
        .send({ ...PRODUTO_VALIDO, id: 'dup-1', nome: 'Outro Nome', quantidade: 9 });

      expect(segundo.status).toBe(200);
      expect(segundo.body).toEqual(primeiro.body);
      expect(pool._produtos).toHaveLength(1);
    });

    it('POST com id de outro usuário devolve 409', async () => {
      await request(app)
        .post('/produtos')
        .set('Authorization', `Bearer ${TOKEN_U1}`)
        .send({ ...PRODUTO_VALIDO, id: 'id-u1' });

      const res = await request(app)
        .post('/produtos')
        .set('Authorization', `Bearer ${TOKEN_U2}`)
        .send({ ...PRODUTO_VALIDO, id: 'id-u1' });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ mensagem: 'Id de produto já em uso.' });
      expect(pool._produtos).toHaveLength(1);
    });

    it('validações 400 rejeitam entradas inválidas antes de consultar o banco', async () => {
      const casos = [
        [{ ...PRODUTO_VALIDO, nome: '' }, 'O nome do produto é obrigatório.'],
        [{ ...PRODUTO_VALIDO, nome: '   ' }, 'O nome do produto é obrigatório.'],
        [{ ...PRODUTO_VALIDO, nome: 'a'.repeat(256) }, 'O nome do produto deve ter no máximo 255 caracteres.'],
        [{ ...PRODUTO_VALIDO, quantidade: 0 }, 'A quantidade deve ser um número inteiro maior que zero.'],
        [{ ...PRODUTO_VALIDO, quantidade: -3 }, 'A quantidade deve ser um número inteiro maior que zero.'],
        [{ ...PRODUTO_VALIDO, quantidade: 1.5 }, 'A quantidade deve ser um número inteiro maior que zero.'],
        [{ ...PRODUTO_VALIDO, quantidade: '2' }, 'A quantidade deve ser um número inteiro maior que zero.'],
        [{ ...PRODUTO_VALIDO, quantidade: true }, 'A quantidade deve ser um número inteiro maior que zero.'],
        [{ ...PRODUTO_VALIDO, quantidade: 2147483648 }, 'A quantidade deve ser um número inteiro maior que zero.'],
        [
          { ...PRODUTO_VALIDO, dataDeValidade: '31/12/2026' },
          'A data de validade deve estar no formato YYYY-MM-DD e ser uma data válida.',
        ],
        [
          { ...PRODUTO_VALIDO, dataDeValidade: '2026-02-30' },
          'A data de validade deve estar no formato YYYY-MM-DD e ser uma data válida.',
        ],
        [
          { ...PRODUTO_VALIDO, dataDeValidade: '2026-13-01' },
          'A data de validade deve estar no formato YYYY-MM-DD e ser uma data válida.',
        ],
        [
          { ...PRODUTO_VALIDO, dataDeCadastro: '2026-11-19' },
          'A data de cadastro deve estar em formato ISO 8601 válido.',
        ],
        [
          { ...PRODUTO_VALIDO, dataDeCadastro: '2026-02-30T10:00:00.000Z' },
          'A data de cadastro deve estar em formato ISO 8601 válido.',
        ],
        [{ ...PRODUTO_VALIDO, fotoUri: 123 }, 'A foto deve ser um texto ou nula.'],
        [{ ...PRODUTO_VALIDO, id: 123 }, 'O id do produto deve ser um texto.'],
        [{ ...PRODUTO_VALIDO, id: 'x'.repeat(256) }, 'O id do produto deve ter no máximo 255 caracteres.'],
      ];

      for (const [body, mensagem] of casos) {
        const res = await request(app)
          .post('/produtos')
          .set('Authorization', `Bearer ${TOKEN_U1}`)
          .send(body);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ mensagem });
      }
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('GET /produtos e GET /produtos/:id', () => {
    it('GET /produtos retorna apenas os produtos do usuário autenticado ordenados por dataDeValidade', async () => {
      await request(app)
        .post('/produtos')
        .set('Authorization', `Bearer ${TOKEN_U1}`)
        .send({ id: 'u1-b', nome: 'Feijão', quantidade: 1, dataDeValidade: '2026-12-20' });
      await request(app)
        .post('/produtos')
        .set('Authorization', `Bearer ${TOKEN_U1}`)
        .send({ id: 'u1-a', nome: 'Arroz', quantidade: 2, dataDeValidade: '2026-11-10' });
      await request(app)
        .post('/produtos')
        .set('Authorization', `Bearer ${TOKEN_U2}`)
        .send({ id: 'u2-a', nome: 'Café', quantidade: 1, dataDeValidade: '2026-10-01' });

      const res = await request(app).get('/produtos').set('Authorization', `Bearer ${TOKEN_U1}`);

      expect(res.status).toBe(200);
      expect(res.body.map((p) => p.id)).toEqual(['u1-a', 'u1-b']);
      expect(res.body.every((p) => p.usuarioId === 1)).toBe(true);
    });

    it('GET /produtos/:id devolve 200 para produto próprio e 404 para produto de outro usuário ou inexistente', async () => {
      await request(app)
        .post('/produtos')
        .set('Authorization', `Bearer ${TOKEN_U1}`)
        .send({ ...PRODUTO_VALIDO, id: 'p-u1' });

      const proprio = await request(app)
        .get('/produtos/p-u1')
        .set('Authorization', `Bearer ${TOKEN_U1}`);
      expect(proprio.status).toBe(200);
      expect(proprio.body.id).toBe('p-u1');

      const alheio = await request(app)
        .get('/produtos/p-u1')
        .set('Authorization', `Bearer ${TOKEN_U2}`);
      expect(alheio.status).toBe(404);
      expect(alheio.body).toEqual({ mensagem: 'Produto não encontrado.' });

      const inexistente = await request(app)
        .get('/produtos/nao-existe')
        .set('Authorization', `Bearer ${TOKEN_U1}`);
      expect(inexistente.status).toBe(404);
      expect(inexistente.body).toEqual({ mensagem: 'Produto não encontrado.' });
    });
  });

  describe('PUT /produtos/:id', () => {
    it('atualiza apenas nome, quantidade, dataDeValidade e fotoUri, mantendo id, usuarioId e dataDeCadastro', async () => {
      const criado = await request(app)
        .post('/produtos')
        .set('Authorization', `Bearer ${TOKEN_U1}`)
        .send({
          id: 'p-edit',
          nome: 'Leite',
          quantidade: 2,
          dataDeValidade: '2026-12-31',
          fotoUri: 'file:///antiga.jpg',
          dataDeCadastro: '2026-11-19T17:00:00.000Z',
        });

      const atualizado = await request(app)
        .put('/produtos/p-edit')
        .set('Authorization', `Bearer ${TOKEN_U1}`)
        .send({
          id: 'outro-id',
          usuarioId: 999,
          dataDeCadastro: 'data-invalida-ignorada',
          nome: '  Leite Desnatado  ',
          quantidade: 5,
          dataDeValidade: '2027-01-10',
          fotoUri: null,
        });

      expect(atualizado.status).toBe(200);
      expect(atualizado.body).toEqual({
        id: 'p-edit',
        usuarioId: 1,
        nome: 'Leite Desnatado',
        quantidade: 5,
        dataDeValidade: '2027-01-10',
        fotoUri: null,
        dataDeCadastro: criado.body.dataDeCadastro,
      });
    });

    it('PUT de produto alheio ou inexistente devolve 404', async () => {
      await request(app)
        .post('/produtos')
        .set('Authorization', `Bearer ${TOKEN_U1}`)
        .send({ ...PRODUTO_VALIDO, id: 'p-u1' });

      const alheio = await request(app)
        .put('/produtos/p-u1')
        .set('Authorization', `Bearer ${TOKEN_U2}`)
        .send({ nome: 'Alterado', quantidade: 3, dataDeValidade: '2027-02-01' });
      expect(alheio.status).toBe(404);
      expect(alheio.body).toEqual({ mensagem: 'Produto não encontrado.' });

      const inexistente = await request(app)
        .put('/produtos/nao-existe')
        .set('Authorization', `Bearer ${TOKEN_U1}`)
        .send({ nome: 'Alterado', quantidade: 3, dataDeValidade: '2027-02-01' });
      expect(inexistente.status).toBe(404);
      expect(inexistente.body).toEqual({ mensagem: 'Produto não encontrado.' });
    });

    it('PUT com body inválido devolve 400 antes de consultar o banco', async () => {
      const res = await request(app)
        .put('/produtos/p-1')
        .set('Authorization', `Bearer ${TOKEN_U1}`)
        .send({ nome: 'Leite', quantidade: '2', dataDeValidade: '2026-12-31' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        mensagem: 'A quantidade deve ser um número inteiro maior que zero.',
      });
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /produtos/:id', () => {
    it('remove produto existente com 204 e não altera nada para inexistente ou alheio (também 204)', async () => {
      await request(app)
        .post('/produtos')
        .set('Authorization', `Bearer ${TOKEN_U1}`)
        .send({ ...PRODUTO_VALIDO, id: 'p-u1' });

      // Outro usuário tenta remover: 204, mas produto do u1 continua intacto.
      const alheio = await request(app)
        .delete('/produtos/p-u1')
        .set('Authorization', `Bearer ${TOKEN_U2}`);
      expect(alheio.status).toBe(204);
      expect(alheio.text).toBe('');
      expect(pool._produtos).toHaveLength(1);

      // Remoção de inexistente: 204.
      const inexistente = await request(app)
        .delete('/produtos/nao-existe')
        .set('Authorization', `Bearer ${TOKEN_U1}`);
      expect(inexistente.status).toBe(204);
      expect(inexistente.text).toBe('');
      expect(pool._produtos).toHaveLength(1);

      // Remoção pelo dono: 204 e item removido.
      const proprio = await request(app)
        .delete('/produtos/p-u1')
        .set('Authorization', `Bearer ${TOKEN_U1}`);
      expect(proprio.status).toBe(204);
      expect(proprio.text).toBe('');
      expect(pool._produtos).toHaveLength(0);
    });
  });
});
