/* global describe, it, expect, beforeEach, afterEach, jest */
/**
 * Testes do NotificacoesService (issue #19): cancelarAlerta por produtoId e
 * inclusão de produtoId no conteúdo das notificações agendadas.
 */
import NotificacoesService from '../services/NotificacoesService';

const mockAgendadas = [];
const mockCancelar = jest.fn();
const mockObterTodas = jest.fn();

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
    const id = `notif-${mockAgendadas.length + 1}`;
    mockAgendadas.push({ identifier: id, ...req });
    return id;
  }),
}));

jest.mock('expo-notifications/build/getAllScheduledNotificationsAsync', () => ({
  getAllScheduledNotificationsAsync: (...args) => mockObterTodas(...args),
}));

jest.mock('expo-notifications/build/cancelScheduledNotificationAsync', () => ({
  cancelScheduledNotificationAsync: (...args) => mockCancelar(...args),
}));

jest.mock('expo-notifications/build/cancelAllScheduledNotificationsAsync', () => ({
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
}));

/** Data local de hoje deslocada em N dias ('YYYY-MM-DD'). */
function dataIso(deslocamentoDias) {
  const data = new Date();
  data.setDate(data.getDate() + deslocamentoDias);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function notificacao(identifier, produtoId) {
  return { identifier, content: { title: 'Produto vencendo', data: produtoId ? { produtoId } : {} } };
}

describe('NotificacoesService', () => {
  beforeEach(() => {
    mockAgendadas.length = 0;
    mockCancelar.mockReset();
    mockCancelar.mockResolvedValue(undefined);
    mockObterTodas.mockReset();
  });

  describe('cancelarAlerta', () => {
    it('deve cancelar somente as notificações com o produtoId correspondente', async () => {
      mockObterTodas.mockResolvedValue([
        notificacao('n1', 'produto-A'),
        notificacao('n2', 'produto-B'),
        notificacao('n3', 'produto-A'),
        notificacao('n4', null),
        { identifier: 'n5', content: { title: 'sem data' } },
      ]);

      await NotificacoesService.cancelarAlerta('produto-A');

      expect(mockCancelar).toHaveBeenCalledTimes(2);
      expect(mockCancelar).toHaveBeenCalledWith('n1');
      expect(mockCancelar).toHaveBeenCalledWith('n3');
      expect(mockCancelar).not.toHaveBeenCalledWith('n2');
      expect(mockCancelar).not.toHaveBeenCalledWith('n4');
      expect(mockCancelar).not.toHaveBeenCalledWith('n5');
    });

    it('deve retornar sem lançar exceção e sem cancelar nada quando não houver notificações do produto', async () => {
      mockObterTodas.mockResolvedValue([notificacao('n1', 'outro')]);
      await expect(NotificacoesService.cancelarAlerta('produto-A')).resolves.toBeUndefined();

      mockObterTodas.mockResolvedValue([]);
      await expect(NotificacoesService.cancelarAlerta('produto-A')).resolves.toBeUndefined();

      expect(mockCancelar).not.toHaveBeenCalled();
    });

    it('não deve lançar exceção quando o cancelamento falha: registra no console com o prefixo do serviço', async () => {
      const consoleErro = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockObterTodas.mockResolvedValue([notificacao('n1', 'produto-A')]);
      mockCancelar.mockRejectedValue(new Error('falha nativa'));

      await expect(NotificacoesService.cancelarAlerta('produto-A')).resolves.toBeUndefined();

      expect(consoleErro).toHaveBeenCalledWith(
        expect.stringContaining('[NotificacoesService]'),
        expect.any(Error)
      );
      consoleErro.mockRestore();
    });
  });

  describe('agendarAlerta: produtoId no content.data', () => {
    afterEach(() => {
      mockAgendadas.length = 0;
    });

    it('deve incluir produtoId nas notificações imediata (vence em até 3 dias) e agendada', async () => {
      await NotificacoesService.agendarAlerta({
        id: 'urgente',
        nome: 'Iogurte',
        dataDeValidade: dataIso(2),
      });
      await NotificacoesService.agendarAlerta({
        id: 'folga',
        nome: 'Pão',
        dataDeValidade: dataIso(15),
      });

      expect(mockAgendadas).toHaveLength(2);
      expect(mockAgendadas[0].content.data).toEqual({ produtoId: 'urgente' });
      expect(mockAgendadas[0].trigger.seconds).toBe(2);
      expect(mockAgendadas[1].content.data).toEqual({ produtoId: 'folga' });
      expect(mockAgendadas[1].trigger.date).toBeInstanceOf(Date);
    });
  });
});
