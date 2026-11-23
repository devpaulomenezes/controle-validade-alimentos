/* global describe, it, expect, beforeEach, afterEach, jest */
process.env.JWT_SECRET = 'segredo-somente-para-testes';

jest.mock('../src/banco', () => {
  const usuarios = [];
  let proximoId = 1;
  const pool = {
    _usuarios: usuarios,
    _reiniciar() {
      usuarios.length = 0;
      proximoId = 1;
    },
    query: jest.fn(async (sql, params) => {
      if (/INSERT INTO usuarios/i.test(sql)) {
        const [nome, email, senhaHash] = params;
        if (usuarios.some((u) => u.email === email)) {
          const erro = new Error('duplicate key value violates unique constraint');
          erro.code = '23505';
          throw erro;
        }
        const usuario = { id: proximoId, nome, email, senhaHash };
        proximoId += 1;
        usuarios.push(usuario);
        return { rows: [{ id: usuario.id, nome, email }] };
      }
      if (/FROM usuarios WHERE email/i.test(sql)) {
        return { rows: usuarios.filter((u) => u.email === params[0]).map((u) => ({ ...u })) };
      }
      throw new Error(`Consulta não prevista no mock: ${sql}`);
    }),
  };
  return { pool, inicializarBanco: jest.fn(async () => {}) };
});

const express = require('express');
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { app, iniciar } = require('../src/app');
const { pool, inicializarBanco } = require('../src/banco');
const autenticar = require('../src/middlewares/autenticacao');

jest.setTimeout(30000);

const SEGREDO = process.env.JWT_SECRET;
const NOVO_USUARIO = { nome: 'Maria', email: 'maria@email.com', senha: 'abc123' };

describe('Autenticação (BE-02)', () => {
  beforeEach(() => {
    pool._reiniciar();
    jest.clearAllMocks();
  });

  describe('POST /auth/registro', () => {
    it('cria o usuário, devolve 201 com token e usuário, sem senha, e grava somente o hash bcrypt', async () => {
      const res = await request(app).post('/auth/registro').send(NOVO_USUARIO);

      expect(res.status).toBe(201);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.usuario).toEqual({ id: 1, nome: 'Maria', email: 'maria@email.com' });
      expect(JSON.stringify(res.body)).not.toMatch(/senha/i);
      expect(JSON.stringify(res.body)).not.toContain(NOVO_USUARIO.senha);

      const [gravado] = pool._usuarios;
      expect(gravado.senhaHash).not.toBe(NOVO_USUARIO.senha);
      expect(gravado.senhaHash).toMatch(/^\$2[aby]\$12\$/);
      expect(await bcrypt.compare(NOVO_USUARIO.senha, gravado.senhaHash)).toBe(true);
    });

    it('emite token com o id do usuário e expiração de 30 dias', async () => {
      const res = await request(app).post('/auth/registro').send(NOVO_USUARIO);

      const payload = jwt.verify(res.body.token, SEGREDO);
      expect(payload.id).toBe(1);
      expect(payload.exp - payload.iat).toBe(30 * 24 * 60 * 60);
    });

    it('sem nenhum campo, devolve 400 listando todos os campos faltantes', async () => {
      const res = await request(app).post('/auth/registro').send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        mensagem: 'Campos obrigatórios não informados: nome, email, senha.',
      });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('lista apenas os campos faltantes (inclui campos vazios)', async () => {
      const res = await request(app)
        .post('/auth/registro')
        .send({ nome: 'Maria', email: '   ', senha: 'abc123' });

      expect(res.status).toBe(400);
      expect(res.body.mensagem).toBe('Campos obrigatórios não informados: email.');
    });

    it('e-mail inválido devolve 400', async () => {
      for (const email of ['maria', 'maria@', 'maria@email', '@email.com', 'ma ria@email.com']) {
        const res = await request(app)
          .post('/auth/registro')
          .send({ ...NOVO_USUARIO, email });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ mensagem: 'E-mail inválido.' });
      }
      expect(pool._usuarios).toHaveLength(0);
    });

    it('senha com menos de 6 caracteres devolve 400', async () => {
      const res = await request(app)
        .post('/auth/registro')
        .send({ ...NOVO_USUARIO, senha: '12345' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ mensagem: 'A senha deve ter no mínimo 6 caracteres.' });
      expect(pool._usuarios).toHaveLength(0);
    });

    it('e-mail já cadastrado devolve 409', async () => {
      await request(app).post('/auth/registro').send(NOVO_USUARIO);

      const res = await request(app)
        .post('/auth/registro')
        .send({ ...NOVO_USUARIO, nome: 'Outra Maria' });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ mensagem: 'E-mail já cadastrado.' });
      expect(pool._usuarios).toHaveLength(1);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/auth/registro').send(NOVO_USUARIO);
    });

    it('com credenciais corretas devolve 200 com token e usuário, sem senha', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: NOVO_USUARIO.email, senha: NOVO_USUARIO.senha });

      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.usuario).toEqual({ id: 1, nome: 'Maria', email: 'maria@email.com' });
      expect(JSON.stringify(res.body)).not.toMatch(/senha/i);
      expect(jwt.verify(res.body.token, SEGREDO).id).toBe(1);
    });

    it('com senha errada devolve 401 "Credenciais inválidas."', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: NOVO_USUARIO.email, senha: 'senha-errada' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ mensagem: 'Credenciais inválidas.' });
    });

    it('com e-mail inexistente devolve a mesma resposta 401', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'ninguem@email.com', senha: NOVO_USUARIO.senha });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ mensagem: 'Credenciais inválidas.' });
    });
  });

  describe('middleware de autenticação', () => {
    const miniApp = express();
    miniApp.get('/protegida', autenticar, (req, res) => res.json({ usuarioId: req.usuarioId }));

    it('sem token devolve 401 "Token não informado."', async () => {
      const res = await request(miniApp).get('/protegida');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ mensagem: 'Token não informado.' });
    });

    it('com cabeçalho que não é Bearer devolve 401 "Token não informado."', async () => {
      const res = await request(miniApp).get('/protegida').set('Authorization', 'Basic abc');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ mensagem: 'Token não informado.' });
    });

    it('com token inválido devolve 401 "Token inválido." sem detalhes internos', async () => {
      const malformado = await request(miniApp)
        .get('/protegida')
        .set('Authorization', 'Bearer isto-nao-e-um-jwt');
      const outroSegredo = await request(miniApp)
        .get('/protegida')
        .set('Authorization', `Bearer ${jwt.sign({ id: 1 }, 'outro-segredo')}`);

      for (const res of [malformado, outroSegredo]) {
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ mensagem: 'Token inválido.' });
      }
    });

    it('com token expirado devolve 401 "Token expirado."', async () => {
      const passado = Math.floor(Date.now() / 1000) - 60;
      const token = jwt.sign({ id: 1, exp: passado }, SEGREDO);

      const res = await request(miniApp).get('/protegida').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ mensagem: 'Token expirado.' });
    });

    it('com token válido define req.usuarioId com o id do usuário', async () => {
      const registro = await request(app).post('/auth/registro').send(NOVO_USUARIO);

      const res = await request(miniApp)
        .get('/protegida')
        .set('Authorization', `Bearer ${registro.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ usuarioId: registro.body.usuario.id });
    });
  });

  describe('inicialização', () => {
    let segredoOriginal;

    beforeEach(() => {
      segredoOriginal = process.env.JWT_SECRET;
    });

    afterEach(() => {
      process.env.JWT_SECRET = segredoOriginal;
    });

    it('sem JWT_SECRET, iniciar() rejeita com erro claro antes de conectar ao banco', async () => {
      delete process.env.JWT_SECRET;

      await expect(iniciar()).rejects.toThrow(
        'JWT_SECRET não definido. Defina a variável de ambiente antes de iniciar o servidor.'
      );
      expect(inicializarBanco).not.toHaveBeenCalled();
    });

    it('com JWT_SECRET vazio, iniciar() também rejeita', async () => {
      process.env.JWT_SECRET = '  ';

      await expect(iniciar()).rejects.toThrow(/JWT_SECRET não definido/);
      expect(inicializarBanco).not.toHaveBeenCalled();
    });
  });
});
