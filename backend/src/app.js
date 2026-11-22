require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { pool, inicializarBanco } = require('./banco');
const { obterSegredo } = require('./servicos/autenticacao');
const rotasAuth = require('./rotas/auth');
const autenticar = require('./middlewares/autenticacao');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

// Colunas com alias (Postgres converte identificadores sem aspas para minúsculas).
// Datas são devolvidas como texto para evitar conversões de fuso pelo driver.
const COLUNAS_PRODUTO = `
  id,
  "usuarioId" AS "usuarioId",
  nome,
  quantidade,
  to_char("dataDeValidade", 'YYYY-MM-DD') AS "dataDeValidade",
  "fotoUri" AS "fotoUri",
  to_char("dataDeCadastro", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "dataDeCadastro"
`;

function erro(res, status, mensagem) {
  return res.status(status).json({ mensagem });
}

function textoValido(valor) {
  return typeof valor === 'string' && valor.trim() !== '';
}

// ---------- Autenticação ----------
app.use('/auth', rotasAuth);

// ---------- Produtos ----------
app.get('/produtos', autenticar, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${COLUNAS_PRODUTO} FROM produtos
       WHERE "usuarioId" = $1
       ORDER BY "dataDeValidade" ASC`,
      [req.usuarioId]
    );
    return res.status(200).json(rows);
  } catch (e) {
    next(e);
  }
});

app.get('/produtos/:id', autenticar, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${COLUNAS_PRODUTO} FROM produtos
       WHERE id = $1 AND "usuarioId" = $2`,
      [req.params.id, req.usuarioId]
    );
    if (rows.length === 0) {
      return erro(res, 404, 'Produto não encontrado.');
    }
    return res.status(200).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

app.post('/produtos', autenticar, async (req, res, next) => {
  try {
    const { id, nome, quantidade, dataDeValidade, fotoUri, dataDeCadastro } = req.body || {};

    if (!textoValido(nome) || !textoValido(dataDeValidade)) {
      return erro(res, 400, 'Informe nome, quantidade e dataDeValidade.');
    }
    const qtd = Number(quantidade);
    if (quantidade === undefined || quantidade === null || !Number.isInteger(qtd)) {
      return erro(res, 400, 'Informe nome, quantidade e dataDeValidade.');
    }

    const idProduto = textoValido(id) ? id : crypto.randomUUID();
    const cadastro = textoValido(dataDeCadastro) ? dataDeCadastro : new Date().toISOString();

    // Id já usado por OUTRO usuário: conflito.
    const outro = await pool.query(
      `SELECT 1 FROM produtos WHERE id = $1 AND "usuarioId" <> $2 LIMIT 1`,
      [idProduto, req.usuarioId]
    );
    if (outro.rows.length > 0) {
      return erro(res, 409, 'Id de produto já em uso.');
    }

    // Id já existente para o MESMO usuário: retorna o registro, sem alterar.
    const inserido = await pool.query(
      `INSERT INTO produtos (id, "usuarioId", nome, quantidade, "dataDeValidade", "fotoUri", "dataDeCadastro")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id, "usuarioId") DO NOTHING
       RETURNING ${COLUNAS_PRODUTO}`,
      [idProduto, req.usuarioId, nome, qtd, dataDeValidade, fotoUri ?? null, cadastro]
    );
    if (inserido.rows.length > 0) {
      return res.status(201).json(inserido.rows[0]);
    }

    const existente = await pool.query(
      `SELECT ${COLUNAS_PRODUTO} FROM produtos
       WHERE id = $1 AND "usuarioId" = $2`,
      [idProduto, req.usuarioId]
    );
    return res.status(200).json(existente.rows[0]);
  } catch (e) {
    next(e);
  }
});

app.put('/produtos/:id', autenticar, async (req, res, next) => {
  try {
    const { nome, quantidade, dataDeValidade, fotoUri } = req.body || {};

    if (!textoValido(nome) || !textoValido(dataDeValidade)) {
      return erro(res, 400, 'Informe nome, quantidade e dataDeValidade.');
    }
    const qtd = Number(quantidade);
    if (quantidade === undefined || quantidade === null || !Number.isInteger(qtd)) {
      return erro(res, 400, 'Informe nome, quantidade e dataDeValidade.');
    }

    const { rows } = await pool.query(
      `UPDATE produtos
       SET nome = $1, quantidade = $2, "dataDeValidade" = $3, "fotoUri" = $4
       WHERE id = $5 AND "usuarioId" = $6
       RETURNING ${COLUNAS_PRODUTO}`,
      [nome, qtd, dataDeValidade, fotoUri ?? null, req.params.id, req.usuarioId]
    );
    if (rows.length === 0) {
      return erro(res, 404, 'Produto não encontrado.');
    }
    return res.status(200).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

app.delete('/produtos/:id', autenticar, async (req, res, next) => {
  try {
    await pool.query(
      `DELETE FROM produtos WHERE id = $1 AND "usuarioId" = $2`,
      [req.params.id, req.usuarioId]
    );
    return res.status(204).send();
  } catch (e) {
    next(e);
  }
});

// ---------- Tratamento de erros ----------
app.use((req, res) => erro(res, 404, 'Rota não encontrada.'));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return erro(res, 400, 'JSON inválido.');
  }
  // 22xxx = dados inválidos (ex.: data mal formatada)
  if (typeof err.code === 'string' && err.code.startsWith('22')) {
    return erro(res, 400, 'Dados inválidos.');
  }
  console.error(err);
  return erro(res, 500, 'Erro interno do servidor.');
});

// ---------- Inicialização ----------
async function iniciar() {
  obterSegredo();
  await inicializarBanco();
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

if (require.main === module) {
  iniciar().catch((e) => {
    console.error('Falha ao iniciar o servidor:', e);
    process.exit(1);
  });
}

module.exports = { app, iniciar };
