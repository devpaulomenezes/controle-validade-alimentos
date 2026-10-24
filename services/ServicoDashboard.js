/**
 * SERVIÇO REAL de agregações do dashboard (issue #5) — camada de serviços
 * da arquitetura do README. Nenhuma tela agrega dados: as telas consomem
 * este serviço. Serviço puro: recebe os produtos como parâmetro e NÃO
 * acessa repositórios. A classificação de cada produto é DELEGADA ao
 * ServicoValidade — nenhum cálculo de data duplicado aqui. Usado pela tela
 * inicial desde a issue #10.
 */
import { classificarSituacao } from './ServicoValidade';

/**
 * Ordena pela validade mais próxima, sem alterar a lista original.
 * Strings 'YYYY-MM-DD' em ordem alfabética já ficam em ordem cronológica.
 * @param {import('../data/Produto').default[]} produtos
 * @returns {import('../data/Produto').default[]} Nova lista ordenada.
 * @example ordenarPorValidade([produtoQueVenceEm30, produtoQueVenceAmanha])[0]
 *   // produtoQueVenceAmanha
 */
export function ordenarPorValidade(produtos) {
  return [...produtos].sort((a, b) => a.dataDeValidade.localeCompare(b.dataDeValidade));
}

/**
 * Contadores do dashboard; a classificação é delegada a classificarSituacao
 * (ServicoValidade), então a soma dos quatro contadores é sempre igual ao
 * total.
 * @param {import('../data/Produto').default[]} produtos
 * @returns {{ total: number, vencidos: number, venceEstaSemana: number, venceEsteMes: number, ok: number }}
 * @example resumirProdutos([produtoVencido, produtoOk]) // { total: 2, vencidos: 1, venceEstaSemana: 0, venceEsteMes: 0, ok: 1 }
 */
export function resumirProdutos(produtos) {
  const resumo = { total: produtos.length, vencidos: 0, venceEstaSemana: 0, venceEsteMes: 0, ok: 0 };
  for (const produto of produtos) {
    const situacao = classificarSituacao(produto);
    resumo[situacao === 'vencido' ? 'vencidos' : situacao] += 1;
  }
  return resumo;
}
