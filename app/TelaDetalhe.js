import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import repositorio from '../data/OfflineFirstProdutoRepository';
import NotificacoesService from '../services/NotificacoesService';
import CameraService from '../services/CameraService';
import { calcularDiasRestantes, classificarSituacao } from '../services/ServicoValidade';
import { espacamento, raio, fonte } from '../theme/theme';
import { useTemaOpcional } from '../theme/ThemeContext';
import { formatarDataBR, dataParaIso } from '../utils/formatoData';

/** Texto dos dias restantes (apenas apresentação; o cálculo vem do ServicoValidade). */
function descreverDias(dias) {
  if (dias < 0) {
    const atraso = Math.abs(dias);
    return `Venceu há ${atraso} ${atraso === 1 ? 'dia' : 'dias'}`;
  }
  if (dias === 0) return 'Vence hoje';
  if (dias === 1) return 'Falta 1 dia';
  return `Faltam ${dias} dias`;
}

/**
 * dataDeCadastro pode ser 'YYYY-MM-DD' ou um ISO completo (gerado pelo repositório).
 * Datas só com dia são formatadas direto; o ISO completo é convertido para a data
 * LOCAL antes de formatar.
 */
function formatarCadastro(dataDeCadastro) {
  if (!dataDeCadastro) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataDeCadastro)) return formatarDataBR(dataDeCadastro);
  const data = new Date(dataDeCadastro);
  if (Number.isNaN(data.getTime())) return '—';
  return formatarDataBR(dataParaIso(data));
}

export default function TelaDetalhe({ navigation, route }) {
  // Tema ativo (TEMA-01); fora do ThemeProvider, o claro (ex.: testes de tela).
  const { cores, situacoes, estilosBase } = useTemaOpcional();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const produtoId = route.params?.produtoId;
  const [carregando, setCarregando] = useState(true);
  const [produto, setProduto] = useState(null);
  const [erro, setErro] = useState(null);
  const [uriComErro, setUriComErro] = useState(null);
  const [removendo, setRemovendo] = useState(false);

  // Recarrega sempre que a tela ganha foco, para refletir edições.
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      repositorio
        .buscarPorId(produtoId)
        .then((encontrado) => {
          if (!ativo) return;
          setProduto(encontrado ?? null);
          setErro(null);
        })
        .catch((e) => {
          console.error('[TelaDetalhe] erro ao carregar produto:', e);
          if (!ativo) return;
          setProduto(null);
          setErro(e?.message || 'Não foi possível carregar o produto.');
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });
      return () => {
        ativo = false;
      };
    }, [produtoId])
  );

  function editar() {
    // Cópia simples: o React Navigation avisa sobre instâncias de classe nos params.
    navigation.navigate('Cadastro', { produto: { ...produto } });
  }

  function confirmarRemocao() {
    Alert.alert('Remover produto', `Remover "${produto.nome}" da lista?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          if (removendo) return;
          setRemovendo(true);
          // Ordem obrigatória: 1) cancelar alerta, 2) remover do repositório,
          // 3) apagar a foto (só se o 2 teve sucesso), 4) voltar e recarregar a lista.
          try {
            await NotificacoesService.cancelarAlerta(produto.id);
            await repositorio.remover(produto.id);
          } catch (e) {
            console.error('[TelaDetalhe] erro ao remover produto:', e);
            setRemovendo(false);
            Alert.alert('Erro', e?.message || 'Não foi possível remover o produto. Tente novamente.');
            return;
          }
          await CameraService.removerFoto(produto.fotoUri);
          navigation.goBack();
        },
      },
    ]);
  }

  if (carregando) {
    return (
      <View style={[estilosBase.tela, styles.centro]}>
        <ActivityIndicator size="large" color={cores.primaria} />
      </View>
    );
  }

  if (!produto) {
    return (
      <View style={[estilosBase.tela, styles.centro, styles.mensagemVazia]}>
        <Text style={styles.tituloMensagem}>
          {erro ? 'Erro ao carregar o produto' : 'Produto não encontrado'}
        </Text>
        <Text style={styles.textoMensagem}>
          {erro ?? 'Ele pode ter sido removido.'}
        </Text>
        <TouchableOpacity
          style={[estilosBase.botaoPrimario, styles.botaoVoltar]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
        >
          <Text style={estilosBase.textoBotaoPrimario}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const situacao = classificarSituacao(produto);
  const estiloSituacao = situacoes[situacao];
  const dias = calcularDiasRestantes(produto.dataDeValidade);
  const temFoto = Boolean(produto.fotoUri) && produto.fotoUri !== uriComErro;

  return (
    <ScrollView style={estilosBase.tela} contentContainerStyle={styles.conteudo}>
      {temFoto ? (
        <Image
          source={{ uri: produto.fotoUri }}
          style={styles.foto}
          resizeMode="cover"
          onError={() => setUriComErro(produto.fotoUri)}
        />
      ) : (
        <View style={[styles.foto, styles.placeholder]}>
          <Text style={styles.iconePlaceholder}>🥫</Text>
        </View>
      )}

      <Text style={styles.nome}>{produto.nome}</Text>

      {estiloSituacao ? (
        <View style={[styles.selo, { backgroundColor: estiloSituacao.fundo }]}>
          <Text style={[styles.textoSelo, { color: estiloSituacao.cor }]}>{estiloSituacao.rotulo}</Text>
        </View>
      ) : null}

      <View style={styles.bloco}>
        <Linha estilos={styles} rotulo="Quantidade" valor={String(produto.quantidade)} />
        <Linha estilos={styles} rotulo="Data de validade" valor={formatarDataBR(produto.dataDeValidade)} />
        <Linha estilos={styles} rotulo="Dias restantes" valor={descreverDias(dias)} />
        <Linha estilos={styles} rotulo="Cadastrado em" valor={formatarCadastro(produto.dataDeCadastro)} />
      </View>

      <TouchableOpacity
        style={[estilosBase.botaoPrimario, styles.botaoAcao]}
        onPress={editar}
        accessibilityRole="button"
        accessibilityLabel="Editar produto"
      >
        <Text style={estilosBase.textoBotaoPrimario}>Editar</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.botaoRemover, styles.botaoAcao, removendo && styles.botaoDesabilitado]}
        onPress={confirmarRemocao}
        disabled={removendo}
        accessibilityRole="button"
        accessibilityLabel="Remover produto"
      >
        <Text style={styles.textoRemover}>Remover</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/** Linha "rótulo: valor" do bloco de dados; recebe os estilos do tema ativo da tela. */
function Linha({ rotulo, valor, estilos }) {
  return (
    <View style={estilos.linha}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Text style={estilos.valor}>{valor}</Text>
    </View>
  );
}

function criarEstilos(cores) {
  return StyleSheet.create({
    centro: {
      justifyContent: 'center',
    },
    mensagemVazia: {
      alignItems: 'center',
      padding: espacamento.lg,
    },
    tituloMensagem: {
      fontSize: fonte.media,
      fontWeight: 'bold',
      color: cores.texto,
      textAlign: 'center',
    },
    textoMensagem: {
      fontSize: fonte.normal,
      color: cores.textoSecundario,
      textAlign: 'center',
      marginTop: espacamento.sm,
    },
    botaoVoltar: {
      marginTop: espacamento.lg,
    },
    conteudo: {
      padding: espacamento.md,
    },
    foto: {
      width: '100%',
      height: 260,
      borderRadius: raio.md,
      backgroundColor: cores.superficie,
      marginBottom: espacamento.md,
    },
    placeholder: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: cores.borda,
    },
    iconePlaceholder: {
      fontSize: 72,
      textAlign: 'center',
    },
    nome: {
      fontSize: fonte.titulo,
      fontWeight: 'bold',
      color: cores.texto,
    },
    selo: {
      alignSelf: 'flex-start',
      borderRadius: raio.pill,
      paddingHorizontal: espacamento.md,
      paddingVertical: 4,
      marginTop: espacamento.sm,
    },
    textoSelo: {
      fontSize: fonte.normal,
      fontWeight: 'bold',
    },
    bloco: {
      backgroundColor: cores.superficie,
      borderRadius: raio.md,
      borderWidth: 1,
      borderColor: cores.borda,
      marginVertical: espacamento.md,
      paddingHorizontal: espacamento.md,
    },
    linha: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: espacamento.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: cores.borda,
    },
    rotulo: {
      fontSize: fonte.normal,
      color: cores.textoSecundario,
    },
    valor: {
      fontSize: fonte.normal,
      fontWeight: '600',
      color: cores.texto,
    },
    botaoAcao: {
      marginTop: espacamento.sm,
    },
    botaoRemover: {
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: raio.md,
      borderWidth: 1,
      borderColor: cores.erro,
    },
    textoRemover: {
      color: cores.erro,
      fontSize: fonte.normal,
      fontWeight: 'bold',
    },
    botaoDesabilitado: {
      opacity: 0.6,
    },
  });
}
