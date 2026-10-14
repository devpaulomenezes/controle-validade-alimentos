import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

const OPCOES_CAPTURA = {
  mediaTypes: ['images'],
  quality: 0.6,
  allowsEditing: false,
};

export default class CameraService {
  static async tirarFoto() {
    return CameraService.#capturar({
      pedirPermissao: ImagePicker.requestCameraPermissionsAsync,
      abrir: ImagePicker.launchCameraAsync,
      recurso: 'a câmera',
    });
  }

  static async escolherDaGaleria() {
    return CameraService.#capturar({
      pedirPermissao: ImagePicker.requestMediaLibraryPermissionsAsync,
      abrir: ImagePicker.launchImageLibraryAsync,
      recurso: 'a galeria',
    });
  }

  /**
   * Copia a foto temporária (do cache de captura) para o armazenamento persistente
   * do app (FileSystem.documentDirectory/fotos), garantindo persistência após reiniciar.
   * @param {string|null} uriTemporaria - URI local temporária retornada pelo picker.
   * @returns {Promise<string|null>} URI persistente no diretório de documentos.
   */
  static async persistirFoto(uriTemporaria) {
    if (!uriTemporaria) return null;
    try {
      const pastaFotos = `${FileSystem.documentDirectory}fotos/`;
      const info = await FileSystem.getInfoAsync(pastaFotos);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(pastaFotos, { intermediates: true });
      }

      const extensao = uriTemporaria.split('.').pop()?.split('?')[0] || 'jpg';
      const nomeArquivo = `foto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;
      const destino = `${pastaFotos}${nomeArquivo}`;

      await FileSystem.copyAsync({ from: uriTemporaria, to: destino });
      return destino;
    } catch (erro) {
      console.error('CameraService: falha ao persistir foto', erro);
      return uriTemporaria;
    }
  }

  static async #capturar({ pedirPermissao, abrir, recurso }) {
    try {
      const permissao = await pedirPermissao();

      if (!permissao.granted) {
        CameraService.#avisarPermissaoNegada(recurso, permissao.canAskAgain);
        return null;
      }

      const resultado = await abrir(OPCOES_CAPTURA);

      if (resultado.canceled || !resultado.assets?.length) {
        return null;
      }

      return resultado.assets[0].uri;
    } catch (erro) {
      console.error(`CameraService: falha ao acessar ${recurso}`, erro);
      Alert.alert('Erro', `Não foi possível acessar ${recurso}. Tente novamente.`);
      return null;
    }
  }

  static #avisarPermissaoNegada(recurso, podePedirDeNovo) {
    if (podePedirDeNovo) {
      Alert.alert(
        'Permissão necessária',
        `Para continuar, permita o acesso a ${recurso}.`
      );
      return;
    }

    Alert.alert(
      'Permissão bloqueada',
      `O acesso a ${recurso} foi negado. Ative-o nas configurações do aparelho.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
      ]
    );
  }
}
