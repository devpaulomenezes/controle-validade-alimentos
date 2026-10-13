/**
 * Conversão e formatação de datas para a interface. Apenas muda o formato —
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

/**
 * Converte um Date (ex.: retorno do date picker) para o formato do contrato,
 * usando a data LOCAL. Não usa toISOString(), que converte para UTC e pode
 * avançar um dia à noite no fuso do Brasil.
 * @param {Date} data
 * @returns {string} 'YYYY-MM-DD'
 * @example dataParaIso(new Date(2026, 9, 13, 23, 30)) // '2026-10-13'
 */
export function dataParaIso(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Converte 'YYYY-MM-DD' em Date local (meia-noite), para abrir o date picker
 * na data já escolhida. new Date('YYYY-MM-DD') seria interpretado como UTC.
 * @param {string} dataIso
 * @returns {Date}
 */
export function isoParaData(dataIso) {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}
