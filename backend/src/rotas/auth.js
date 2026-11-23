const express = require('express');
const servico = require('../servicos/autenticacao');

const router = express.Router();

function responderErro(e, res, next) {
  if (e instanceof servico.ErroAutenticacao) {
    return res.status(e.status).json({ mensagem: e.message });
  }
  return next(e);
}

router.post('/registro', async (req, res, next) => {
  try {
    const resultado = await servico.registrar(req.body || {});
    return res.status(201).json(resultado);
  } catch (e) {
    return responderErro(e, res, next);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const resultado = await servico.autenticar(req.body || {});
    return res.status(200).json(resultado);
  } catch (e) {
    return responderErro(e, res, next);
  }
});

module.exports = router;
