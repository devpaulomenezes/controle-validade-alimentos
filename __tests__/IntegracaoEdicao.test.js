/* global describe, it, expect, beforeEach, afterEach, jest */
/**
 * Cenário de edição na integração (issue #19): edita um produto da base de 5
 * itens e verifica listagem, situação calculada, contadores do dashboard e o
 * reagendamento do alerta (cancelar por produtoId + agendar de novo).
 */
import repositorio from '../data/JsonProdutoRepository';
import Produto from '../data/Produto';
import { classificarSituacao } from '../services/ServicoValidade';
import { ordenarPorValidade, resumirProdutos } from '../services/ServicoDashboard';
import NotificacoesService from '../services/NotificacoesService';

const mockArmazenamento = {};
const mockNotificacoesAgendadas = [];

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/documentos-teste/',
  getInfoAsync: jest.fn(async (caminho) => ({
    exists: Object.prototype.hasOwnProperty.call(mockArmazenamento, caminho),
  })),
  readAsStringAsync: jest.fn(async (caminho) => {
    if (!Object.prototype.hasOwnProperty.call(mockArmazenamento, caminho)) {
      throw new Error(`Arquivo não encontrado: ${caminho}`);
    }
    return mockArmazenamento[caminho];
  }),
  writeAsStringAsync: jest.fn(async (caminho, conteudo) => {
    mockArmazenamento[caminho] = conteudo;
  }),
}));

jest.mock('expo-notifications/build/NotificationsHandler', () => ({
  setNotificationHandler: jest.fn(),
}));

jest.mock('expo-notifications/build/NotificationPermissions', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
}));

jest.mock('expo-notifications/build/setNotificationChannelAsync', () => ({
  setNotificationChannelAsync: jest.fn(async () => {}),
}));

jest.mock('expo-notifications/build/scheduleNotificationAsync', () => ({
  scheduleNotificationAsync: jest.fn(async (req) => {
    const id = `notif-${mockNotificacoesAgendadas.length + 1}-${Math.random().toString(36).slice(2, 6)}`;
    mockNotificacoesAgendadas.push({ identifier: id, ...req });
    return id;
  }),
}));

jest.mock('expo-notifications/build/getAllScheduledNotificationsAsync', () => ({
  getAllScheduledNotificationsAsync: jest.fn(async () => [...mockNotificacoesAgendadas]),
}));

jest.mock('expo-notifications/build/cancelScheduledNotificationAsync', () => ({
  cancelScheduledNotificationAsync: jest.fn(async (identifier) => {
    const indice = mockNotificacoesAgendadas.findIndex((n) => n.identifier === identifier);
    if (indice !== -1) mockNotificacoesAgendadas.splice(indice, 1);
  }),
}));

jest.mock('expo-notifications/build/cancelAllScheduledNotificationsAsync', () => ({
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {
    mockNotificacoesAgendadas.length = 0;
  }),
}));

/** Data local de hoje deslocada em N dias ('YYYY-MM-DD'). */
function dataIso(deslocamentoDias) {
  const data = new Date();
  data.setDate(data.getDate() + deslocamentoDias);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

describe('Integração: edição de produto (issue #19)', () => {
  beforeEach(() => {
    for (const chave of Object.keys(mockArmazenamento)) {
      delete mockArmazenamento[chave];
    }
    mockNotificacoesAgendadas.length = 0;
  });

  afterEach(() => {
    mockNotificacoesAgendadas.length = 0;
  });

  it('deve refletir a edição de um dos 5 produtos na listagem, na situação, nos contadores do dashboard e no alerta', async () => {
    const entradas = [
      { nome: 'Arroz Tipo 1', quantidade: 2, dataDeValidade: dataIso(45) }, // ok
      { nome: 'Iogurte Natural', quantidade: 4, dataDeValidade: dataIso(2) }, // venceEstaSemana
      { nome: 'Leite Integral', quantidade: 1, dataDeValidade: dataIso(-3) }, // vencido
      { nome: 'Pão de Forma', quantidade: 1, dataDeValidade: dataIso(15) }, // venceEsteMes
      { nome: 'Queijo Minas', quantidade: 1, dataDeValidade: dataIso(6) }, // venceEstaSemana
    ];

    for (const dados of entradas) {
      const salvo = await repositorio.salvar(
        new Produto({ id: null, ...dados, fotoUri: null, dataDeCadastro: null })
      );
      // Como a TelaCadastro: o alerta usa o produto devolvido (id real).
      await NotificacoesService.agendarAlerta(salvo);
    }

    // Estado inicial: 1 vencido, 2 esta semana, 1 este mês, 1 ok.
    const antes = await repositorio.listar();
    expect(antes).toHaveLength(5);
    expect(resumirProdutos(antes)).toEqual({
      total: 5,
      vencidos: 1,
      venceEstaSemana: 2,
      venceEsteMes: 1,
      ok: 1,
    });
    expect(mockNotificacoesAgendadas).toHaveLength(5);

    // Edita o produto vencido: novo nome, nova quantidade e validade em +20 dias.
    const leite = antes.find((p) => p.nome === 'Leite Integral');
    const atualizado = new Produto({
      id: leite.id,
      nome: 'Leite Desnatado',
      quantidade: 6,
      dataDeValidade: dataIso(20),
      fotoUri: leite.fotoUri,
      dataDeCadastro: leite.dataDeCadastro,
    });
    await repositorio.atualizar(atualizado);
    // Como a TelaCadastro na edição: cancelar o alerta antigo e agendar de novo.
    await NotificacoesService.cancelarAlerta(atualizado.id);
    await NotificacoesService.agendarAlerta(atualizado);

    // Listagem: mesma quantidade, id e dataDeCadastro preservados, dados novos.
    const depois = await repositorio.listar();
    expect(depois).toHaveLength(5);
    const editado = depois.find((p) => p.id === leite.id);
    expect(editado.nome).toBe('Leite Desnatado');
    expect(editado.quantidade).toBe(6);
    expect(editado.dataDeValidade).toBe(dataIso(20));
    expect(editado.dataDeCadastro).toBe(leite.dataDeCadastro);
    expect(depois.some((p) => p.nome === 'Leite Integral')).toBe(false);

    // Ordenação e situação calculada refletem a nova validade.
    const ordenados = ordenarPorValidade(depois);
    expect(ordenados.map((p) => p.nome)).toEqual([
      'Iogurte Natural',
      'Queijo Minas',
      'Pão de Forma',
      'Leite Desnatado',
      'Arroz Tipo 1',
    ]);
    expect(ordenados.map((p) => classificarSituacao(p))).toEqual([
      'venceEstaSemana',
      'venceEstaSemana',
      'venceEsteMes',
      'venceEsteMes',
      'ok',
    ]);
    expect(classificarSituacao(editado)).toBe('venceEsteMes');

    // Dashboard: o vencido virou "este mês"; o total continua 5 e a soma fecha.
    const resumo = resumirProdutos(depois);
    expect(resumo).toEqual({
      total: 5,
      vencidos: 0,
      venceEstaSemana: 2,
      venceEsteMes: 2,
      ok: 1,
    });
    expect(resumo.vencidos + resumo.venceEstaSemana + resumo.venceEsteMes + resumo.ok).toBe(resumo.total);

    // Alerta: continua 1 por produto (sem duplicar) e o do editado tem o id certo.
    expect(mockNotificacoesAgendadas).toHaveLength(5);
    const doEditado = mockNotificacoesAgendadas.filter(
      (n) => n.content.data.produtoId === leite.id
    );
    expect(doEditado).toHaveLength(1);
    expect(doEditado[0].content.body).toBe('Leite Desnatado vence em 3 dias!');
    expect(doEditado[0].trigger.date).toBeInstanceOf(Date);
  });
});
