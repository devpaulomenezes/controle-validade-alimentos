import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  StyleSheet,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Produto from '../data/Produto';
import repositorio from '../data/JsonProdutoRepository';
import CameraService from '../services/CameraService';
import NotificacoesService from '../services/NotificacoesService';
import { cores, espacamento, raio, fonte, estilosBase } from '../components/theme';
import { formatarDataBR, dataParaIso, isoParaData } from '../components/formatoData';

function validar({ nome, quantidade, dataDeValidade }) {
  const erros = {};
  if (!nome.trim()) {
    erros.nome = 'Informe o nome do produto.';
  }
  const qtd = Number(quantidade);
  if (!quantidade.trim()) {
    erros.quantidade = 'Informe a quantidade.';
  } else if (!Number.isInteger(qtd) || qtd <= 0) {
    erros.quantidade = 'A quantidade deve ser um número inteiro maior que zero.';
  }
  if (!dataDeValidade) {
    erros.dataDeValidade = 'Selecione a data de validade.';
  }
  return erros;
}

/**
 * Pergunta se o produto deve ser salvo sem foto quando a cópia da foto para
 * a pasta do app falhou (CameraService.persistirFoto devolveu null).
 * @returns {Promise<boolean>} true = salvar sem foto.
 */
function confirmarSalvarSemFoto() {
  return new Promise((resolve) => {
    Alert.alert(
      'Foto não salva',
      'Não foi possível guardar a foto no aparelho. Deseja salvar o produto sem foto?',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Salvar sem foto', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

export default function TelaCadastro({ navigation }) {
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [dataDeValidade, setDataDeValidade] = useState(null); // 'YYYY-MM-DD'
  const [fotoUri, setFotoUri] = useState(null);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [mostrarSeletorIOS, setMostrarSeletorIOS] = useState(false);
  const campoQuantidade = useRef(null);
  // Bloqueia um 2º toque rápido em Salvar antes de o estado "salvando" chegar ao botão.
  const salvandoRef = useRef(false);

  function limparErro(campo) {
    setErros((atuais) => ({ ...atuais, [campo]: undefined }));
  }

  function liberarSalvar() {
    salvandoRef.current = false;
    setSalvando(false);
  }

  function selecionarData(data) {
    setDataDeValidade(dataParaIso(data));
    limparErro('dataDeValidade');
  }

  function abrirSeletorDeData() {
    const valorInicial = dataDeValidade ? isoParaData(dataDeValidade) : new Date();
    if (Platform.OS === 'android') {
      // API imperativa: forma recomendada pela biblioteca no Android.
      DateTimePickerAndroid.open({
        value: valorInicial,
        mode: 'date',
        onValueChange: (_evento, data) => selecionarData(data),
      });
    } else {
      setMostrarSeletorIOS(true);
    }
  }

  // No Android o Alert mostra no máximo 3 botões; por isso "Remover foto"
  // fica fora daqui, como botão próprio na pré-visualização.
  function abrirOpcoesFoto() {
    Alert.alert(
      'Foto do produto',
      'Escolha como adicionar a foto:',
      [
        {
          text: 'Tirar foto',
          onPress: async () => {
            const uri = await CameraService.tirarFoto();
            if (uri) setFotoUri(uri);
          },
        },
        {
          text: 'Escolher da galeria',
          onPress: async () => {
            const uri = await CameraService.escolherDaGaleria();
            if (uri) setFotoUri(uri);
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  }

  async function salvar() {
    if (salvandoRef.current) return;
    const novosErros = validar({ nome, quantidade, dataDeValidade });
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    salvandoRef.current = true;
    setSalvando(true);
    try {
      const fotoPersistida = fotoUri ? await CameraService.persistirFoto(fotoUri) : null;
      if (fotoUri && !fotoPersistida && !(await confirmarSalvarSemFoto())) {
        liberarSalvar();
        return;
      }

      // id e dataDeCadastro são gerados pelo repositório.
      const produto = new Produto({
        id: null,
        nome: nome.trim(),
        quantidade: Number(quantidade),
        dataDeValidade,
        fotoUri: fotoPersistida,
        dataDeCadastro: null,
      });

      await repositorio.salvar(produto);
      // Alerta local 3 dias antes do vencimento (#12); o serviço trata as próprias falhas.
      await NotificacoesService.agendarAlerta(produto);
      // Sucesso: o botão continua desabilitado; a tela fecha no OK do alerta.
      Alert.alert('Produto salvo', `"${produto.nome}" foi cadastrado com sucesso.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (erro) {
      console.error('[TelaCadastro] erro ao salvar produto:', erro);
      liberarSalvar();
      Alert.alert('Erro ao salvar', 'Não foi possível salvar o produto. Tente novamente.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilosBase.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <View style={styles.grupo}>
          <Text style={estilosBase.rotulo}>Nome</Text>
          <TextInput
            style={[estilosBase.campo, erros.nome && styles.campoComErro]}
            placeholder="Ex.: Leite integral"
            placeholderTextColor={cores.textoSecundario}
            value={nome}
            onChangeText={(texto) => {
              setNome(texto);
              limparErro('nome');
            }}
            maxLength={60}
            returnKeyType="next"
            onSubmitEditing={() => campoQuantidade.current?.focus()}
          />
          {erros.nome ? <Text style={estilosBase.textoErro}>{erros.nome}</Text> : null}
        </View>

        <View style={styles.grupo}>
          <Text style={estilosBase.rotulo}>Quantidade</Text>
          <TextInput
            ref={campoQuantidade}
            style={[estilosBase.campo, erros.quantidade && styles.campoComErro]}
            placeholder="Ex.: 2"
            placeholderTextColor={cores.textoSecundario}
            value={quantidade}
            onChangeText={(texto) => {
              setQuantidade(texto);
              limparErro('quantidade');
            }}
            keyboardType="number-pad"
            maxLength={5}
          />
          {erros.quantidade ? <Text style={estilosBase.textoErro}>{erros.quantidade}</Text> : null}
        </View>

        <View style={styles.grupo}>
          <Text style={estilosBase.rotulo}>Data de validade</Text>
          <TouchableOpacity
            style={[estilosBase.campo, styles.campoData, erros.dataDeValidade && styles.campoComErro]}
            onPress={abrirSeletorDeData}
            accessibilityRole="button"
            accessibilityLabel="Selecionar data de validade"
          >
            <Text style={dataDeValidade ? styles.textoData : styles.textoPlaceholder}>
              {dataDeValidade ? formatarDataBR(dataDeValidade) : 'Selecionar data'}
            </Text>
          </TouchableOpacity>
          {erros.dataDeValidade ? (
            <Text style={estilosBase.textoErro}>{erros.dataDeValidade}</Text>
          ) : null}

          {Platform.OS === 'ios' && mostrarSeletorIOS ? (
            <View style={styles.seletorIOS}>
              <DateTimePicker
                value={dataDeValidade ? isoParaData(dataDeValidade) : new Date()}
                mode="date"
                display="inline"
                onValueChange={(_evento, data) => selecionarData(data)}
              />
              <TouchableOpacity onPress={() => setMostrarSeletorIOS(false)}>
                <Text style={styles.confirmarData}>Confirmar data</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.grupo}>
          <Text style={estilosBase.rotulo}>Foto do produto (opcional)</Text>
          {fotoUri ? (
            <View style={styles.containerPreviewFoto}>
              <Image source={{ uri: fotoUri }} style={styles.previewFoto} resizeMode="cover" />
              <View style={styles.acoesFoto}>
                <TouchableOpacity
                  style={styles.botaoAlterarFoto}
                  onPress={abrirOpcoesFoto}
                  accessibilityRole="button"
                  accessibilityLabel="Trocar foto"
                >
                  <Text style={styles.textoBotaoAlterarFoto}>Trocar foto</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.botaoAlterarFoto}
                  onPress={() => setFotoUri(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Remover foto"
                >
                  <Text style={[styles.textoBotaoAlterarFoto, styles.textoRemoverFoto]}>Remover foto</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[estilosBase.campo, styles.campoFoto]}
              onPress={abrirOpcoesFoto}
              accessibilityRole="button"
              accessibilityLabel="Adicionar foto"
            >
              <Text style={styles.textoPlaceholderFoto}>Adicionar foto</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[estilosBase.botaoPrimario, styles.botaoSalvar, salvando && styles.botaoDesabilitado]}
          onPress={salvar}
          disabled={salvando}
        >
          <Text style={estilosBase.textoBotaoPrimario}>{salvando ? 'Salvando...' : 'Salvar'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    padding: espacamento.md,
  },
  grupo: {
    marginBottom: espacamento.md,
  },
  campoComErro: {
    borderColor: cores.erro,
  },
  campoData: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textoData: {
    fontSize: fonte.normal,
    color: cores.texto,
  },
  textoPlaceholder: {
    fontSize: fonte.normal,
    color: cores.textoSecundario,
  },
  campoFoto: {
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    paddingVertical: espacamento.md,
  },
  textoPlaceholderFoto: {
    color: cores.primaria,
    fontWeight: '600',
    fontSize: fonte.normal,
  },
  containerPreviewFoto: {
    alignItems: 'center',
    backgroundColor: cores.superficie,
    borderRadius: raio.md,
    borderColor: cores.borda,
    borderWidth: 1,
    padding: espacamento.sm,
  },
  previewFoto: {
    width: '100%',
    height: 180,
    borderRadius: raio.sm,
    backgroundColor: cores.fundo,
  },
  acoesFoto: {
    flexDirection: 'row',
    gap: espacamento.md,
  },
  botaoAlterarFoto: {
    marginTop: espacamento.sm,
    paddingVertical: espacamento.xs + 2,
    paddingHorizontal: espacamento.md,
  },
  textoBotaoAlterarFoto: {
    color: cores.primaria,
    fontWeight: '600',
    fontSize: fonte.pequena,
  },
  textoRemoverFoto: {
    color: cores.erro,
  },
  seletorIOS: {
    marginTop: espacamento.sm,
    backgroundColor: cores.superficie,
    borderRadius: raio.md,
    padding: espacamento.sm,
  },
  confirmarData: {
    color: cores.primaria,
    fontSize: fonte.normal,
    fontWeight: 'bold',
    textAlign: 'right',
    padding: espacamento.sm,
  },
  botaoSalvar: {
    marginTop: espacamento.sm,
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
});
