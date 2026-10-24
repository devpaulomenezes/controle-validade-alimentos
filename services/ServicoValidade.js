/**
 * SERVIÇO REAL de regras de vencimento (issue #4) — camada de serviços da
 * arquitetura do README. Nenhuma tela calcula datas: as telas consomem este
 * serviço. Serviço puro: recebe o Produto como parâmetro e NÃO acessa
 * repositórios. Usado pelas telas, pelo ServicoDashboard e pelo
 * NotificacoesService desde a issue #10.
 */
import { isoParaData } from '../components/formatoData';

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Data de hoje com hora zerada (só a data, no fuso local). */
function hojeSoData() {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
}

/**
 * Diferença em dias inteiros entre a data de validade e hoje, considerando
 * apenas a DATA (ignora hora/minuto) e sem deslocamento por fuso horário:
 * o parse é local (isoParaData) e a subtração compara duas meias-noites
 * locais; Math.round absorve qualquer ruído de horário.
 * @param {string} dataDeValidade - Data no formato do contrato ('YYYY-MM-DD').
 * @returns {number} Dias restantes (negativo se já venceu; 0 = vence hoje).
 * @example calcularDiasRestantes('2026-10-24') // 1, se hoje for 2026-10-23
 */
export function calcularDiasRestantes(dataDeValidade) {
  const validade = isoParaData(dataDeValidade);
  return Math.round((validade - hojeSoData()) / UM_DIA_MS);
}

/**
 * Classifica o produto em uma das quatro situações:
 * vencido (menos de 0 dias), venceEstaSemana (0 a 7 dias, inclusive hoje),
 * venceEsteMes (8 a 30 dias) e ok (mais de 30 dias).
 * @param {import('../data/Produto').default} produto
 * @returns {'vencido'|'venceEstaSemana'|'venceEsteMes'|'ok'}
 * @example classificarSituacao(produtoQueVenceHoje) // 'venceEstaSemana'
 */
export function classificarSituacao(produto) {
  const dias = calcularDiasRestantes(produto.dataDeValidade);
  if (dias < 0) return 'vencido';
  if (dias <= 7) return 'venceEstaSemana';
  if (dias <= 30) return 'venceEsteMes';
  return 'ok';
}
