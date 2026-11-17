import { Alert, Linking, Platform } from 'react-native';
import { cancelAllScheduledNotificationsAsync } from 'expo-notifications/build/cancelAllScheduledNotificationsAsync';
import { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
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
  cancelScheduledNotificationAsync,
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
        // produtoId permite cancelar o alerta depois (cancelarAlerta); o
        // identifier da notificação não é guardado no produto nem no JSON.
        data: { produtoId: produto.id },
        body:
          dias > DIAS_ANTECEDENCIA
            ? montarCorpo(produto.nome, DIAS_ANTECEDENCIA)
            : montarCorpo(produto.nome, dias),
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

  /**
   * Cancela as notificações agendadas do produto (content.data.produtoId).
   * Não lança exceção se não houver nenhuma; falhas são registradas no console
   * e não impedem a edição nem a remoção do produto.
   * @param {string} produtoId
   */
  static async cancelarAlerta(produtoId) {
    try {
      const agendadas = await Notifications.getAllScheduledNotificationsAsync();
      const doProduto = agendadas.filter(
        (notificacao) => notificacao.content?.data?.produtoId === produtoId
      );
      for (const notificacao of doProduto) {
        await Notifications.cancelScheduledNotificationAsync(notificacao.identifier);
      }
    } catch (erro) {
      console.error('[NotificacoesService] falha ao cancelar alerta do produto:', erro);
    }
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
