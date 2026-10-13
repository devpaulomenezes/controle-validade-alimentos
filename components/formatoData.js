/**
 * Formatação de datas para EXIBIÇÃO. Apenas converte o formato do texto —
 * não faz cálculo de vencimento (isso é responsabilidade do ServicoValidade).
 */

/**
 * @param {string} dataIso - Data no formato do contrato ('YYYY-MM-DD').
 * @returns {string} Data no formato brasileiro ('DD/MM/YYYY').
 * @example formatarDataBR('2026-10-13') // '13/10/2026'
 */
export function formatarDataBR(dataIso) {
  if (!dataIso) return '';
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}
