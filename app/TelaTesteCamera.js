import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import CameraService from '../services/CameraService';
import { cores, espacamento, raio, fonte, estilosBase } from '../components/theme';

export default function TelaTesteCamera({ navigation }) {
  const [fotoUri, setFotoUri] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function handleTirarFoto() {
    setCarregando(true);
    const uri = await CameraService.tirarFoto();
    if (uri) {
      setFotoUri(uri);
    }
    setCarregando(false);
  }

  async function handleEscolherDaGaleria() {
    setCarregando(true);
    const uri = await CameraService.escolherDaGaleria();
    if (uri) {
      setFotoUri(uri);
    }
    setCarregando(false);
  }

  function handleLimpar() {
    setFotoUri(null);
  }

  return (
    <ScrollView style={estilosBase.tela} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>Teste do CameraService</Text>
      <Text style={styles.descricao}>
        Tela de teste isolada para validação da Issue #11: captura de foto pela câmera e seleção pela galeria.
      </Text>

      <View style={styles.botoes}>
        <TouchableOpacity
          style={[estilosBase.botaoPrimario, styles.botao, carregando && styles.botaoDesabilitado]}
          onPress={handleTirarFoto}
          disabled={carregando}
        >
          <Text style={estilosBase.textoBotaoPrimario}>Tirar foto</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[estilosBase.botaoPrimario, styles.botao, styles.botaoGaleria, carregando && styles.botaoDesabilitado]}
          onPress={handleEscolherDaGaleria}
          disabled={carregando}
        >
          <Text style={estilosBase.textoBotaoPrimario}>Escolher da galeria</Text>
        </TouchableOpacity>
      </View>

      {carregando ? (
        <View style={styles.carregando}>
          <ActivityIndicator size="small" color={cores.primaria} />
          <Text style={styles.textoCarregando}>Aguardando captura...</Text>
        </View>
      ) : null}

      <View style={styles.cardPreview}>
        <Text style={estilosBase.rotulo}>Pré-visualização da foto:</Text>
        {fotoUri ? (
          <View style={styles.containerFoto}>
            <Image source={{ uri: fotoUri }} style={styles.imagem} resizeMode="contain" />
            <Text style={styles.rotuloUri}>URI retornada (contrato fotoUri):</Text>
            <Text style={styles.textoUri} numberOfLines={3} selectable>
              {fotoUri}
            </Text>
            <TouchableOpacity style={styles.botaoLimpar} onPress={handleLimpar}>
              <Text style={styles.textoBotaoLimpar}>Remover foto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.semFoto}>
            <Text style={styles.textoSemFoto}>Nenhuma foto capturada ainda.</Text>
            <Text style={styles.subtextoSemFoto}>
              Toque em um dos botões acima para testar as permissões e o retorno da URI.
            </Text>
          </View>
        )}
      </View>

      {navigation?.canGoBack?.() ? (
        <TouchableOpacity style={styles.botaoVoltar} onPress={() => navigation.goBack()}>
          <Text style={styles.textoBotaoVoltar}>Voltar</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    padding: espacamento.md,
  },
  titulo: {
    fontSize: fonte.titulo,
    fontWeight: 'bold',
    color: cores.texto,
    marginBottom: espacamento.xs,
  },
  descricao: {
    fontSize: fonte.normal,
    color: cores.textoSecundario,
    marginBottom: espacamento.lg,
  },
  botoes: {
    gap: espacamento.sm,
    marginBottom: espacamento.md,
  },
  botao: {
    marginVertical: 2,
  },
  botaoGaleria: {
    backgroundColor: cores.primariaEscura,
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  carregando: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacamento.sm,
    marginBottom: espacamento.md,
  },
  textoCarregando: {
    fontSize: fonte.normal,
    color: cores.textoSecundario,
  },
  cardPreview: {
    backgroundColor: cores.superficie,
    borderRadius: raio.md,
    borderColor: cores.borda,
    borderWidth: 1,
    padding: espacamento.md,
    marginBottom: espacamento.lg,
  },
  containerFoto: {
    alignItems: 'center',
    marginTop: espacamento.sm,
  },
  imagem: {
    width: '100%',
    height: 240,
    borderRadius: raio.md,
    backgroundColor: cores.fundo,
    marginBottom: espacamento.sm,
  },
  rotuloUri: {
    fontSize: fonte.pequena,
    fontWeight: '600',
    color: cores.textoSecundario,
    alignSelf: 'flex-start',
    marginTop: espacamento.xs,
  },
  textoUri: {
    fontSize: fonte.pequena,
    color: cores.texto,
    backgroundColor: cores.fundo,
    padding: espacamento.xs + 2,
    borderRadius: raio.sm,
    width: '100%',
    marginTop: espacamento.xs,
  },
  botaoLimpar: {
    marginTop: espacamento.md,
    paddingVertical: espacamento.xs + 2,
    paddingHorizontal: espacamento.md,
    borderRadius: raio.sm,
    backgroundColor: cores.fundo,
  },
  textoBotaoLimpar: {
    color: cores.erro,
    fontSize: fonte.pequena,
    fontWeight: '600',
  },
  semFoto: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: espacamento.xl,
  },
  textoSemFoto: {
    fontSize: fonte.normal,
    fontWeight: 'bold',
    color: cores.textoSecundario,
  },
  subtextoSemFoto: {
    fontSize: fonte.pequena,
    color: cores.textoSecundario,
    textAlign: 'center',
    marginTop: espacamento.xs,
    paddingHorizontal: espacamento.md,
  },
  botaoVoltar: {
    alignItems: 'center',
    paddingVertical: espacamento.sm,
  },
  textoBotaoVoltar: {
    fontSize: fonte.normal,
    color: cores.primaria,
    fontWeight: '600',
  },
});
