import { Alert, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const DIAS_ANTECEDENCIA = 3;
const HORA_ALERTA = 9;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const CANAL_ANDROID = 'validade';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function parseDataLocal(dataIso) {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

export function calcularDiasRestantes(dataDeValidade, hoje = new Date()) {
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const vencimento = parseDataLocal(dataDeValidade);
  return Math.round((vencimento - inicioHoje) / MS_POR_DIA);
}

function montarCorpo(nome, dias) {
  if (dias < 0) {
    const atraso = Math.abs(dias);
    return `${nome} venceu há ${atraso} ${atraso === 1 ? 'dia' : 'dias'}!`;
  }
  if (dias === 0) return `${nome} vence hoje!`;
  if (dias === 1) return `${nome} vence amanhã!`;
  return `${nome} vence em ${dias} dias!`;
}

export default class NotificacoesService {
  static async agendarAlerta(produto) {
    try {
      const permitido = await NotificacoesService.#garantirPermissao();
      if (!permitido) return null;

      await NotificacoesService.#garantirCanalAndroid();

      const dias = calcularDiasRestantes(produto.dataDeValidade);
      const content = {
        title: 'Produto vencendo',
        body: montarCorpo(produto.nome, dias),
      };

      let trigger;
      if (dias <= DIAS_ANTECEDENCIA) {
        trigger = {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
          channelId: CANAL_ANDROID,
        };
      } else {
        const data = parseDataLocal(produto.dataDeValidade);
        data.setDate(data.getDate() - DIAS_ANTECEDENCIA);
        data.setHours(HORA_ALERTA, 0, 0, 0);
        trigger = {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: data,
          channelId: CANAL_ANDROID,
        };
      }

      return await Notifications.scheduleNotificationAsync({ content, trigger });
    } catch (erro) {
      console.error('NotificacoesService: falha ao agendar alerta', erro);
      Alert.alert('Erro', 'Não foi possível agendar o alerta. Tente novamente.');
      return null;
    }
  }

  static async listarAgendadas() {
    return Notifications.getAllScheduledNotificationsAsync();
  }

  static async cancelarTodas() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  static async #garantirPermissao() {
    let permissao = await Notifications.getPermissionsAsync();

    if (!permissao.granted && permissao.canAskAgain) {
      permissao = await Notifications.requestPermissionsAsync();
    }

    if (permissao.granted) return true;

    Alert.alert(
      'Notificações desativadas',
      'Ative as notificações nas configurações do aparelho para receber os alertas de validade.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }

  static async #garantirCanalAndroid() {
    if (Platform.OS !== 'android') return;
    try {
      await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
        name: 'Validade de produtos',
        importance: Notifications.AndroidImportance.HIGH,
      });
    } catch {
      // No Expo Go no Android, o gerenciador de canais não é exposto nativamente.
    }
  }
}
