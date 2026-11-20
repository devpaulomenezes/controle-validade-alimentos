import React, { useLayoutEffect, useRef, useState } from 'react';
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
import repositorio from '../data/OfflineFirstProdutoRepository';
import CameraService from '../services/CameraService';
import NotificacoesService from '../services/NotificacoesService';
import { cores, espacamento, raio, fonte, estilosBase } from '../theme/theme';
import { calcularDiasRestantes } from '../services/ServicoValidade';
import { formatarDataBR, dataParaIso, isoParaData } from '../utils/formatoData';

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
  } else if (calcularDiasRestantes(dataDeValidade) < 0) {
    erros.dataDeValidade = 'A data de validade não pode ser anterior à data de hoje.';
  }
  return erros;
}

/** Hoje às 00:00 no fuso local, para o minimumDate do seletor. */
function inicioDeHoje() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
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

export default function TelaCadastro({ navigation, route }) {
  // Modo edição quando chega um produto em route.params; senão, modo criação.
  const produtoEdicao = route?.params?.produto ?? null;
  const modoEdicao = Boolean(produtoEdicao?.id);
  const fotoOriginal = produtoEdicao?.fotoUri ?? null;

  const [nome, setNome] = useState(produtoEdicao?.nome ?? '');
  const [quantidade, setQuantidade] = useState(
    produtoEdicao ? String(produtoEdicao.quantidade ?? '') : ''
  );
  const [dataDeValidade, setDataDeValidade] = useState(produtoEdicao?.dataDeValidade ?? null); // 'YYYY-MM-DD'
  const [fotoUri, setFotoUri] = useState(fotoOriginal);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [mostrarSeletorIOS, setMostrarSeletorIOS] = useState(false);
  const campoQuantidade = useRef(null);
  // Bloqueia um 2º toque rápido em Salvar antes de o estado "salvando" chegar ao botão.
  const salvandoRef = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: modoEdicao ? 'Editar produto' : 'Novo produto' });
  }, [navigation, modoEdicao]);

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
        minimumDate: inicioDeHoje(),
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

  /** Mensagem do Alert de erro: usa a da exceção, com texto padrão se vier vazia. */
  function mensagemDeErro(erro) {
    return erro?.message || 'Não foi possível salvar o produto. Tente novamente.';
  }

  async function salvarCriacao() {
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

    // fotoPersistida só existe se a cópia foi feita NESTA tentativa (com "salvar sem foto" é null).
    let salvo;
    try {
      salvo = await repositorio.salvar(produto);
    } catch (erro) {
      // Falha ao salvar: descarta só a cópia feita agora, para não deixar foto órfã.
      if (fotoPersistida) {
        await CameraService.removerFoto(fotoPersistida);
      }
      throw erro;
    }
    // Alerta local 3 dias antes do vencimento (#12); o serviço trata as próprias falhas.
    // Usa o produto devolvido pelo repositório para o alerta levar o id real (produtoId).
    await NotificacoesService.agendarAlerta(salvo ?? produto);
    // Sucesso: o botão continua desabilitado; a tela fecha no OK do alerta.
    Alert.alert('Produto salvo', `"${produto.nome}" foi cadastrado com sucesso.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }

  async function salvarEdicao() {
    let fotoFinal = fotoUri;
    // Cópia feita NESTA tentativa (só existe se a foto foi trocada).
    let fotoNovaCopiada = null;
    let produtoAtualizado;

    try {
      if (fotoUri && fotoUri !== fotoOriginal) {
        const persistida = await CameraService.persistirFoto(fotoUri);
        if (persistida) {
          fotoNovaCopiada = persistida;
          fotoFinal = persistida;
        } else if (await confirmarSalvarSemFoto()) {
          fotoFinal = null;
        } else {
          liberarSalvar();
          return;
        }
      }

      // Mantém id e dataDeCadastro ORIGINAIS; nunca chama salvar() na edição.
      produtoAtualizado = new Produto({
        id: produtoEdicao.id,
        nome: nome.trim(),
        quantidade: Number(quantidade),
        dataDeValidade,
        fotoUri: fotoFinal,
        dataDeCadastro: produtoEdicao.dataDeCadastro,
      });

      await repositorio.atualizar(produtoAtualizado);
    } catch (erro) {
      // Falha ao atualizar: a base não mudou; descarta só a cópia nova desta
      // tentativa (nunca a foto original).
      if (fotoNovaCopiada && fotoNovaCopiada !== fotoOriginal) {
        await CameraService.removerFoto(fotoNovaCopiada);
      }
      throw erro;
    }

    // Sucesso real: a base já foi atualizada. Apaga a foto antiga (trocada ou removida).
    if (fotoOriginal && fotoOriginal !== fotoFinal) {
      await CameraService.removerFoto(fotoOriginal);
    }
    // Reagenda sempre (mesmo com a mesma data) para não duplicar alertas.
    await NotificacoesService.cancelarAlerta(produtoAtualizado.id);
    await NotificacoesService.agendarAlerta(produtoAtualizado);
    navigation.goBack();
  }

  async function salvar() {
    if (salvandoRef.current) return;
    const novosErros = validar({ nome, quantidade, dataDeValidade });
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    salvandoRef.current = true;
    setSalvando(true);
    try {
      if (modoEdicao) {
        await salvarEdicao();
      } else {
        await salvarCriacao();
      }
    } catch (erro) {
      console.error('[TelaCadastro] erro ao salvar produto:', erro);
      liberarSalvar();
      Alert.alert('Erro ao salvar', mensagemDeErro(erro));
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
                minimumDate={inicioDeHoje()}
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
