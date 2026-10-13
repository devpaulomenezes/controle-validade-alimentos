/**
 * MOCK TEMPORÁRIO dos serviços do bloco de dados, com as MESMAS assinaturas
 * previstas nas issues #4 (ServicoValidade.classificarSituacao) e #5
 * (ServicoDashboard.ordenarPorValidade). Na issue #10, as telas trocam este
 * import pelos serviços reais e este arquivo é removido. A regra oficial de
 * vencimento é a do ServicoValidade (#4); esta é só uma aproximação.
 */
import { isoParaData } from '../components/formatoData';

const UM_DIA_MS = 24 * 60 * 60 * 1000;

function diasRestantes(dataDeValidade) {
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  // Math.round compensa a hora a mais/a menos de dias com horário de verão.
  return Math.round((isoParaData(dataDeValidade) - hoje) / UM_DIA_MS);
}

/**
 * @param {import('../data/Produto').default} produto
 * @returns {'vencido'|'venceEstaSemana'|'venceEsteMes'|'ok'}
 */
export function classificarSituacao(produto) {
  const dias = diasRestantes(produto.dataDeValidade);
  if (dias < 0) return 'vencido';
  if (dias <= 7) return 'venceEstaSemana';
  if (dias <= 30) return 'venceEsteMes';
  return 'ok';
}

/**
 * Ordena pela validade mais próxima, sem alterar a lista original.
 * Strings 'YYYY-MM-DD' em ordem alfabética já ficam em ordem cronológica.
 * @param {import('../data/Produto').default[]} produtos
 */
export function ordenarPorValidade(produtos) {
  return [...produtos].sort((a, b) => a.dataDeValidade.localeCompare(b.dataDeValidade));
}
