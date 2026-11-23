require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { inicializarBanco } = require('./banco');
const { obterSegredo } = require('./servicos/autenticacao');
const rotasAuth = require('./rotas/auth');
const rotasProdutos = require('./rotas/produtos');
const autenticar = require('./middlewares/autenticacao');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

function erro(res, status, mensagem) {
  return res.status(status).json({ mensagem });
}

// ---------- Autenticação ----------
app.use('/auth', rotasAuth);

// ---------- Produtos ----------
app.use('/produtos', autenticar, rotasProdutos);

// ---------- Tratamento de erros ----------
app.use((req, res) => erro(res, 404, 'Rota não encontrada.'));

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
