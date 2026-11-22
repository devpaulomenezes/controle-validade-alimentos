const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../banco');

const CUSTO_BCRYPT = 12;
const EXPIRACAO_TOKEN = '30d';
const TAMANHO_MINIMO_SENHA = 6;
const EMAIL_BASICO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class ErroAutenticacao extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.name = 'ErroAutenticacao';
    this.status = status;
  }
}

function obterSegredo() {
  const segredo = process.env.JWT_SECRET;
  if (!segredo || segredo.trim() === '') {
    throw new Error(
      'JWT_SECRET não definido. Defina a variável de ambiente antes de iniciar o servidor.'
    );
  }
  return segredo;
}

function textoValido(valor) {
  return typeof valor === 'string' && valor.trim() !== '';
}

function emailValido(email) {
  return EMAIL_BASICO.test(email.trim());
}

function senhaValida(senha) {
  return senha.length >= TAMANHO_MINIMO_SENHA;
}

function validarRegistro({ nome, email, senha }) {
  const campos = { nome, email, senha };
  const faltando = Object.keys(campos).filter((campo) => !textoValido(campos[campo]));
  if (faltando.length > 0) {
    throw new ErroAutenticacao(
      400,
      `Campos obrigatórios não informados: ${faltando.join(', ')}.`
    );
  }
  if (!emailValido(email)) {
    throw new ErroAutenticacao(400, 'E-mail inválido.');
  }
  if (!senhaValida(senha)) {
    throw new ErroAutenticacao(
      400,
      `A senha deve ter no mínimo ${TAMANHO_MINIMO_SENHA} caracteres.`
    );
  }
}

function gerarHash(senha) {
  return bcrypt.hash(senha, CUSTO_BCRYPT);
}

function compararSenha(senha, hash) {
  return bcrypt.compare(senha, hash);
}

function gerarToken(usuario) {
  return jwt.sign({ id: usuario.id }, obterSegredo(), { expiresIn: EXPIRACAO_TOKEN });
}

function verificarToken(token) {
  const segredo = obterSegredo();
  try {
    return jwt.verify(token, segredo);
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      throw new ErroAutenticacao(401, 'Token expirado.');
    }
    throw new ErroAutenticacao(401, 'Token inválido.');
  }
}

async function registrar({ nome, email, senha }) {
  validarRegistro({ nome, email, senha });

  const emailNormalizado = email.trim().toLowerCase();
  const senhaHash = await gerarHash(senha);

  try {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, "senhaHash")
       VALUES ($1, $2, $3)
       RETURNING id, nome, email`,
      [nome.trim(), emailNormalizado, senhaHash]
    );
    const usuario = rows[0];
    return { token: gerarToken(usuario), usuario };
  } catch (e) {
    if (e.code === '23505') {
      throw new ErroAutenticacao(409, 'E-mail já cadastrado.');
    }
    throw e;
  }
}

async function autenticar({ email, senha }) {
  const credenciaisInvalidas = new ErroAutenticacao(401, 'Credenciais inválidas.');
  if (!textoValido(email) || !textoValido(senha)) {
    throw credenciaisInvalidas;
  }

  const { rows } = await pool.query(
    `SELECT id, nome, email, "senhaHash" AS "senhaHash"
     FROM usuarios WHERE email = $1`,
    [email.trim().toLowerCase()]
  );
  const registro = rows[0];
  if (!registro || !(await compararSenha(senha, registro.senhaHash))) {
    throw credenciaisInvalidas;
  }

  const usuario = { id: registro.id, nome: registro.nome, email: registro.email };
  return { token: gerarToken(usuario), usuario };
}

module.exports = {
  ErroAutenticacao,
  obterSegredo,
  emailValido,
  senhaValida,
  validarRegistro,
  gerarHash,
  compararSenha,
  gerarToken,
  verificarToken,
  registrar,
  autenticar,
};
