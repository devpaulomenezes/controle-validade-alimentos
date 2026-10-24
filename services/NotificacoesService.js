import { Alert, Linking, Platform } from 'react-native';
import { cancelAllScheduledNotificationsAsync } from 'expo-notifications/build/cancelAllScheduledNotificationsAsync';
import { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import { calcularDiasRestantes } from './ServicoValidade';
import { isoParaData } from '../components/formatoData';

const Notifications = {
  AndroidImportance,
  SchedulableTriggerInputTypes,
  cancelAllScheduledNotificationsAsync,
  getAllScheduledNotificationsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
};

const DIAS_ANTECEDENCIA = 3;
const HORA_ALERTA = 9;
const CANAL_ANDROID = 'validade';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
        const data = isoParaData(produto.dataDeValidade);
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
