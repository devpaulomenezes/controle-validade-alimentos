const express = require('express');
const servico = require('../servicos/produtos');

const router = express.Router();

function responderErro(e, res, next) {
  if (e instanceof servico.ErroProduto) {
    return res.status(e.status).json({ mensagem: e.message });
  }
  return next(e);
}

router.get('/', async (req, res, next) => {
  try {
    const produtos = await servico.listar(req.usuarioId);
    return res.status(200).json(produtos);
  } catch (e) {
    return responderErro(e, res, next);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const produto = await servico.buscarPorId(req.params.id, req.usuarioId);
    return res.status(200).json(produto);
  } catch (e) {
    return responderErro(e, res, next);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { status, produto } = await servico.criar(req.body || {}, req.usuarioId);
    return res.status(status).json(produto);
  } catch (e) {
    return responderErro(e, res, next);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const produto = await servico.atualizar(req.params.id, req.body || {}, req.usuarioId);
    return res.status(200).json(produto);
  } catch (e) {
    return responderErro(e, res, next);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await servico.remover(req.params.id, req.usuarioId);
    return res.status(204).send();
  } catch (e) {
    return responderErro(e, res, next);
  }
});

module.exports = router;
