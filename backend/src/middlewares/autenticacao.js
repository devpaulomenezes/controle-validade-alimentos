const servico = require('../servicos/autenticacao');

function autenticar(req, res, next) {
  try {
    const cabecalho = req.headers.authorization || '';
    const [tipo, token] = cabecalho.split(' ');

    if (tipo !== 'Bearer' || !token) {
      throw new servico.ErroAutenticacao(401, 'Token não informado.');
    }

    const payload = servico.verificarToken(token);
    req.usuarioId = payload.id;
    return next();
  } catch (e) {
    if (e instanceof servico.ErroAutenticacao) {
      return res.status(e.status).json({ mensagem: e.message });
    }
    return next(e);
  }
}

module.exports = autenticar;
