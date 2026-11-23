const crypto = require('crypto');
const { pool } = require('../banco');

const TAMANHO_MAXIMO_TEXTO = 255;
const QUANTIDADE_MAXIMA = 2147483647;
const DATA_YYYY_MM_DD = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATA_ISO_HORA =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

const COLUNAS_PRODUTO = `
  id,
  "usuarioId" AS "usuarioId",
  nome,
  quantidade,
  to_char("dataDeValidade", 'YYYY-MM-DD') AS "dataDeValidade",
  "fotoUri" AS "fotoUri",
  to_char("dataDeCadastro", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "dataDeCadastro"
`;

class ErroProduto extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.name = 'ErroProduto';
    this.status = status;
  }
}

function dataCalendarioValida(ano, mes, dia) {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia
  );
}

function validarId(id) {
  if (id === undefined || id === null) {
    return crypto.randomUUID();
  }
  if (typeof id !== 'string') {
    throw new ErroProduto(400, 'O id do produto deve ser um texto.');
  }
  const limpo = id.trim();
  if (limpo === '') {
    return crypto.randomUUID();
  }
  if (limpo.length > TAMANHO_MAXIMO_TEXTO) {
    throw new ErroProduto(400, 'O id do produto deve ter no máximo 255 caracteres.');
  }
  return limpo;
}

function validarDataDeCadastro(dataDeCadastro) {
  if (dataDeCadastro === undefined || dataDeCadastro === null) {
    return new Date().toISOString();
  }
  if (typeof dataDeCadastro === 'string' && dataDeCadastro.trim() === '') {
    return new Date().toISOString();
  }
  if (typeof dataDeCadastro !== 'string') {
    throw new ErroProduto(400, 'A data de cadastro deve estar em formato ISO 8601 válido.');
  }
  const combinado = dataDeCadastro.trim().match(DATA_ISO_HORA);
  if (!combinado) {
    throw new ErroProduto(400, 'A data de cadastro deve estar em formato ISO 8601 válido.');
  }
  const ano = Number(combinado[1]);
  const mes = Number(combinado[2]);
  const dia = Number(combinado[3]);
  const hora = Number(combinado[4]);
  const minuto = Number(combinado[5]);
  const segundo = Number(combinado[6]);
  const fuso = combinado[8];

  if (!dataCalendarioValida(ano, mes, dia) || hora > 23 || minuto > 59 || segundo > 59) {
    throw new ErroProduto(400, 'A data de cadastro deve estar em formato ISO 8601 válido.');
  }
  if (fuso !== 'Z') {
    const fusoHora = Number(fuso.slice(1, 3));
    const fusoMinuto = Number(fuso.slice(4, 6));
    if (fusoHora > 23 || fusoMinuto > 59) {
      throw new ErroProduto(400, 'A data de cadastro deve estar em formato ISO 8601 válido.');
    }
  }
  const data = new Date(dataDeCadastro.trim());
  if (Number.isNaN(data.getTime())) {
    throw new ErroProduto(400, 'A data de cadastro deve estar em formato ISO 8601 válido.');
  }
  return data.toISOString();
}

function validarNome(nome) {
  if (typeof nome !== 'string' || nome.trim() === '') {
    throw new ErroProduto(400, 'O nome do produto é obrigatório.');
  }
  const limpo = nome.trim();
  if (limpo.length > TAMANHO_MAXIMO_TEXTO) {
    throw new ErroProduto(400, 'O nome do produto deve ter no máximo 255 caracteres.');
  }
  return limpo;
}

function validarQuantidade(quantidade) {
  if (
    typeof quantidade !== 'number' ||
    !Number.isInteger(quantidade) ||
    quantidade <= 0 ||
    quantidade > QUANTIDADE_MAXIMA
  ) {
    throw new ErroProduto(400, 'A quantidade deve ser um número inteiro maior que zero.');
  }
  return quantidade;
}

function validarDataDeValidade(dataDeValidade) {
  if (typeof dataDeValidade !== 'string') {
    throw new ErroProduto(
      400,
      'A data de validade deve estar no formato YYYY-MM-DD e ser uma data válida.'
    );
  }
  const combinado = dataDeValidade.match(DATA_YYYY_MM_DD);
  if (
    !combinado ||
    !dataCalendarioValida(Number(combinado[1]), Number(combinado[2]), Number(combinado[3]))
  ) {
    throw new ErroProduto(
      400,
      'A data de validade deve estar no formato YYYY-MM-DD e ser uma data válida.'
    );
  }
  return dataDeValidade;
}

function validarFotoUri(fotoUri) {
  if (fotoUri === undefined || fotoUri === null || fotoUri === '') {
    return null;
  }
  if (typeof fotoUri !== 'string') {
    throw new ErroProduto(400, 'A foto deve ser um texto ou nula.');
  }
  return fotoUri;
}

async function listar(usuarioId) {
  const { rows } = await pool.query(
    `SELECT ${COLUNAS_PRODUTO} FROM produtos
     WHERE "usuarioId" = $1
     ORDER BY "dataDeValidade" ASC`,
    [usuarioId]
  );
  return rows;
}

async function buscarPorId(id, usuarioId) {
  const { rows } = await pool.query(
    `SELECT ${COLUNAS_PRODUTO} FROM produtos
     WHERE id = $1 AND "usuarioId" = $2`,
    [id, usuarioId]
  );
  if (rows.length === 0) {
    throw new ErroProduto(404, 'Produto não encontrado.');
  }
  return rows[0];
}

async function criar(dados, usuarioId) {
  const { id, nome, quantidade, dataDeValidade, fotoUri, dataDeCadastro } = dados || {};

  const nomeValidado = validarNome(nome);
  const quantidadeValidada = validarQuantidade(quantidade);
  const validadeValidada = validarDataDeValidade(dataDeValidade);
  const fotoValidada = validarFotoUri(fotoUri);
  const idValidado = validarId(id);
  const cadastroValidado = validarDataDeCadastro(dataDeCadastro);

  const outro = await pool.query(
    `SELECT 1 FROM produtos WHERE id = $1 AND "usuarioId" <> $2 LIMIT 1`,
    [idValidado, usuarioId]
  );
  if (outro.rows.length > 0) {
    throw new ErroProduto(409, 'Id de produto já em uso.');
  }

  const inserido = await pool.query(
    `INSERT INTO produtos (id, "usuarioId", nome, quantidade, "dataDeValidade", "fotoUri", "dataDeCadastro")
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id, "usuarioId") DO NOTHING
     RETURNING ${COLUNAS_PRODUTO}`,
    [
      idValidado,
      usuarioId,
      nomeValidado,
      quantidadeValidada,
      validadeValidada,
      fotoValidada,
      cadastroValidado,
    ]
  );
  if (inserido.rowCount === 1) {
    return { status: 201, produto: inserido.rows[0] };
  }

  const existente = await pool.query(
    `SELECT ${COLUNAS_PRODUTO} FROM produtos
     WHERE id = $1 AND "usuarioId" = $2`,
    [idValidado, usuarioId]
  );
  return { status: 200, produto: existente.rows[0] };
}

async function atualizar(id, dados, usuarioId) {
  const { nome, quantidade, dataDeValidade, fotoUri } = dados || {};

  const nomeValidado = validarNome(nome);
  const quantidadeValidada = validarQuantidade(quantidade);
  const validadeValidada = validarDataDeValidade(dataDeValidade);
  const fotoValidada = validarFotoUri(fotoUri);

  const { rows } = await pool.query(
    `UPDATE produtos
     SET nome = $1, quantidade = $2, "dataDeValidade" = $3, "fotoUri" = $4
     WHERE id = $5 AND "usuarioId" = $6
     RETURNING ${COLUNAS_PRODUTO}`,
    [nomeValidado, quantidadeValidada, validadeValidada, fotoValidada, id, usuarioId]
  );
  if (rows.length === 0) {
    throw new ErroProduto(404, 'Produto não encontrado.');
  }
  return rows[0];
}

async function remover(id, usuarioId) {
  await pool.query(
    `DELETE FROM produtos WHERE id = $1 AND "usuarioId" = $2`,
    [id, usuarioId]
  );
}

module.exports = {
  ErroProduto,
  listar,
  buscarPorId,
  criar,
  atualizar,
  remover,
};
