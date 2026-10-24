/* global describe, it, expect */
/**
 * Testes unitários para ServicoValidade (Issue #6).
 * Valida o cálculo de dias restantes e a classificação de situação
 * com base nas regras de vencimento da Issue #4.
 */
import { calcularDiasRestantes, classificarSituacao } from '../services/ServicoValidade';


/**
 * Retorna a data local de hoje deslocada em N dias no formato 'YYYY-MM-DD'.
 * Utiliza componentes locais de data para manter o mesmo contrato do ServicoValidade
 * e evitar desvios causados por fuso horário UTC (como ocorreria com toISOString).
 * @param {number} deslocamentoDias - Quantidade de dias a somar (positivo) ou subtrair (negativo).
 * @returns {string} Data no formato ISO 'YYYY-MM-DD'.
 */
function dataIso(deslocamentoDias) {
  const data = new Date();
  data.setDate(data.getDate() + deslocamentoDias);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

describe('ServicoValidade', () => {
  describe('calcularDiasRestantes', () => {
    it('deve retornar -1 para data no passado (ontem)', () => {
      expect(calcularDiasRestantes(dataIso(-1))).toBe(-1);
    });

    it('deve retornar 0 para data de hoje', () => {
      expect(calcularDiasRestantes(dataIso(0))).toBe(0);
    });

    it('deve retornar 1 para data no futuro (amanhã)', () => {
      expect(calcularDiasRestantes(dataIso(1))).toBe(1);
    });
  });

  describe('classificarSituacao', () => {
    it('deve classificar como "vencido" para produto vencido ontem', () => {
      const produto = {
        id: 'teste-1',
        nome: 'Leite',
        quantidade: 1,
        dataDeValidade: dataIso(-1),
        fotoUri: null,
        dataDeCadastro: '2026-10-24',
      };
      expect(classificarSituacao(produto)).toBe('vencido');
    });

    it('deve classificar como "venceEstaSemana" para produto que vence hoje', () => {
      const produto = {
        id: 'teste-2',
        nome: 'Iogurte',
        quantidade: 2,
        dataDeValidade: dataIso(0),
        fotoUri: null,
        dataDeCadastro: '2026-10-24',
      };
      expect(classificarSituacao(produto)).toBe('venceEstaSemana');
    });

    it('deve classificar como "venceEstaSemana" para produto que vence em 7 dias', () => {
      const produto = {
        id: 'teste-3',
        nome: 'Queijo',
        quantidade: 1,
        dataDeValidade: dataIso(7),
        fotoUri: null,
        dataDeCadastro: '2026-10-24',
      };
      expect(classificarSituacao(produto)).toBe('venceEstaSemana');
    });

    it('deve classificar como "venceEsteMes" para produto que vence em 8 dias', () => {
      const produto = {
        id: 'teste-4',
        nome: 'Pão',
        quantidade: 1,
        dataDeValidade: dataIso(8),
        fotoUri: null,
        dataDeCadastro: '2026-10-24',
      };
      expect(classificarSituacao(produto)).toBe('venceEsteMes');
    });

    it('deve classificar como "ok" para produto que vence no mês que vem (31 dias)', () => {
      const produto = {
        id: 'teste-5',
        nome: 'Arroz',
        quantidade: 5,
        dataDeValidade: dataIso(31),
        fotoUri: null,
        dataDeCadastro: '2026-10-24',
      };
      expect(classificarSituacao(produto)).toBe('ok');
    });
  });
});
