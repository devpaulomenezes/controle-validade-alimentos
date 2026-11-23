import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ProdutoCard from '../components/ProdutoCard';
import EmptyState from '../components/EmptyState';
import PainelDashboard from '../components/PainelDashboard';
import IndicadorSincronizacao from '../components/IndicadorSincronizacao';
import { espacamento, raio, fonte } from '../theme/theme';
import { useTemaOpcional } from '../theme/ThemeContext';
import repositorio from '../data/OfflineFirstProdutoRepository';
import AuthService from '../services/AuthService';
import { classificarSituacao } from '../services/ServicoValidade';
import { ordenarPorValidade, resumirProdutos } from '../services/ServicoDashboard';
import NotificacoesService from '../services/NotificacoesService';
import CameraService from '../services/CameraService';

const FILTROS = [
  { chave: 'todas', rotulo: 'Todas' },
  { chave: 'vencido', rotulo: 'Vencidos' },
  { chave: 'venceEstaSemana', rotulo: 'Vencem esta semana' },
  { chave: 'venceEsteMes', rotulo: 'Vencem este mês' },
  { chave: 'ok', rotulo: 'Ok' },
];

/** Minúsculas e sem acentos, para "lei" encontrar "Leite" e "feijao" encontrar "Feijão". */
function normalizar(texto) {
  const minusculo = texto.toLowerCase();
  return typeof minusculo.normalize === 'function'
    ? minusculo.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : minusculo;
}

/** Lê os produtos do cache local do repositório, já ordenados e com a situação de cada um. */
async function carregarItens() {
  const ler = repositorio.listarLocal
    ? () => repositorio.listarLocal()
    : () => repositorio.listar();
  const produtos = ordenarPorValidade(await ler());
  return produtos.map((produto) => ({ produto, situacao: classificarSituacao(produto) }));
}

/**
 * @param {Object} props
 * @param {Object} props.navigation
 * @param {() => void} [props.aoDeslogar] - Avisa o App.js após o logout (APP-07).
 * @param {() => void} [props.aoSessaoExpirada] - Avisa o App.js após um 401 (APP-07).
 * @param {React.ComponentType} [props.BotaoTema] - Botão de alternância do tema, vindo do
 *   App.js (TEMA-01); exibido ao lado do "+ Novo", pois este cabeçalho define o próprio headerRight.
 */
export default function TelaInicial({ navigation, aoDeslogar, aoSessaoExpirada, BotaoTema }) {
  // Tema ativo (TEMA-01); fora do ThemeProvider, o claro (ex.: testes de tela).
  const { cores, situacoes, estilosBase } = useTemaOpcional();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const [itens, setItens] = useState([]); // [{ produto, situacao }]
  const [carregando, setCarregando] = useState(true);
  const [removendo, setRemovendo] = useState(false);
  const [erroCarga, setErroCarga] = useState(null); // mensagem quando listar() falha
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [saindo, setSaindo] = useState(false);
  const [pendentes, setPendentes] = useState(0); // alterações do usuário ainda na fila
  const [sincronizando, setSincronizando] = useState(false);
  const [atualizandoPelaLista, setAtualizandoPelaLista] = useState(false); // RefreshControl

  const abrirCadastro = useCallback(() => navigation.navigate('Cadastro'), [navigation]);
  const abrirDetalhe = useCallback(
    (produto) => navigation.navigate('TelaDetalhe', { produtoId: produto.id }),
    [navigation]
  );
  // Cópia simples: o React Navigation avisa sobre instâncias de classe nos params.
  const abrirEdicao = useCallback(
    (produto) => navigation.navigate('Cadastro', { produto: { ...produto } }),
    [navigation]
  );

  /** Falha ao ler a base: avisa, mostra o estado de falha e NÃO grava nada. */
  const tratarErroCarga = useCallback((erro) => {
    console.error('[TelaInicial] erro ao carregar produtos:', erro);
    const mensagem = erro?.message || 'Não foi possível carregar os produtos.';
    setItens([]);
    setErroCarga(mensagem);
    Alert.alert('Erro ao carregar', mensagem);
  }, []);

  /** 401 na sincronização: apaga a sessão local e avisa o App.js (volta ao login). */
  const tratarSessaoExpirada = useCallback(async () => {
    try {
      await AuthService.logout();
    } catch (erro) {
      console.error('[TelaInicial] erro ao apagar a sessão expirada:', erro);
    }
    aoSessaoExpirada?.();
  }, [aoSessaoExpirada]);

  /**
   * Logout: aguarda uma eventual sincronização em curso terminar, bloqueia
   * enquanto houver operações do usuário na fila (sair agora perderia esses
   * dados) e, sem pendências, limpa o cache local — o próximo usuário não vê
   * os produtos do anterior — e só então apaga a sessão.
   */
  const sair = useCallback(async () => {
    if (saindo) return;
    setSaindo(true);
    try {
      try {
        await repositorio.aguardarSincronizacao();
      } catch {
        // Ignora falha da sincronização em curso; a contagem de pendências abaixo decide o bloqueio.
      }
      const totalPendentes = await repositorio.quantidadePendente();
      if (totalPendentes > 0) {
        const quantidade =
          totalPendentes === 1 ? '1 alteração' : `${totalPendentes} alterações`;
        Alert.alert(
          'Alterações não sincronizadas',
          `Você tem ${quantidade} aguardando conexão. Conecte-se à internet antes de sair, para não perder esses dados.`
        );
        return;
      }
      await repositorio.limparCacheLocal();
      await AuthService.logout();
      aoDeslogar?.();
    } catch (erro) {
      console.error('[TelaInicial] erro ao sair:', erro);
      Alert.alert('Erro', erro?.message || 'Não foi possível sair. Tente novamente.');
    } finally {
      setSaindo(false);
    }
  }, [saindo, aoDeslogar]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={sair}
          disabled={saindo}
          accessibilityRole="button"
          accessibilityLabel="Sair"
          accessibilityState={{ disabled: saindo }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.areaBotaoCabecalho}
        >
          <Text style={styles.botaoCabecalho}>Sair</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={styles.acoesCabecalho}>
          {BotaoTema ? <BotaoTema /> : null}
          <TouchableOpacity
            onPress={abrirCadastro}
            accessibilityRole="button"
            accessibilityLabel="Adicionar produto"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.areaBotaoCabecalho}
          >
            <Text style={styles.botaoCabecalho}>+ Novo</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, abrirCadastro, sair, saindo, BotaoTema, styles]);

  // Promessa da sincronização em andamento. Fica numa ref, e não num estado:
  // se este useCallback dependesse de um estado que ele mesmo altera, sua
  // identidade mudaria a cada execução e o useFocusEffect abaixo o chamaria
  // em loop. Pedidos feitos durante ela (foco, toque no banner, puxar a lista)
  // recebem a mesma promessa, em vez de disparar outra sincronização.
  const sincronizacaoRef = useRef(null);

  /**
   * Envia a fila, baixa a base remota, recarrega a lista a partir do cache
   * local e atualiza a contagem de pendências do banner. Nunca rejeita.
   */
  const sincronizarRepositorio = useCallback(() => {
    if (sincronizacaoRef.current) return sincronizacaoRef.current;

    const sincronizarERecarregar = async () => {
      let sessaoExpirada = false;
      try {
        const resultado = await repositorio.sincronizar();
        sessaoExpirada = Boolean(resultado?.sessaoExpirada);
      } catch (erro) {
        // Sincronizar é melhor-esforço: a lista local ainda é carregada abaixo.
        console.error('[TelaInicial] erro ao sincronizar:', erro);
      }
      if (sessaoExpirada) {
        await tratarSessaoExpirada();
        return;
      }
      try {
        setItens(await carregarItens());
        setErroCarga(null);
      } catch (erro) {
        tratarErroCarga(erro);
      }
      try {
        setPendentes(await repositorio.quantidadePendente());
      } catch (erro) {
        console.error('[TelaInicial] erro ao contar pendências:', erro);
      }
    };

    const executar = async () => {
      setSincronizando(true);
      try {
        await sincronizarERecarregar();
      } finally {
        // Também após erro ou 401: o banner nunca fica preso em "Sincronizando...".
        setSincronizando(false);
      }
    };

    sincronizacaoRef.current = executar().finally(() => {
      sincronizacaoRef.current = null;
    });
    return sincronizacaoRef.current;
  }, [tratarErroCarga, tratarSessaoExpirada]);

  /** Puxar a lista para baixo: o indicador do RefreshControl fica até a sincronização terminar. */
  const atualizarPelaLista = useCallback(async () => {
    setAtualizandoPelaLista(true);
    try {
      await sincronizarRepositorio();
    } finally {
      setAtualizandoPelaLista(false);
    }
  }, [sincronizarRepositorio]);

  // Sincroniza e recarrega sempre que a tela ganha foco (ex.: ao voltar do cadastro).
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      sincronizarRepositorio().finally(() => {
        if (ativo) setCarregando(false);
      });
      return () => {
        ativo = false;
      };
    }, [sincronizarRepositorio])
  );

  const confirmarRemocao = useCallback(
    (produto) => {
      Alert.alert('Remover produto', `Remover "${produto.nome}" da lista?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            if (removendo) return;
            setRemovendo(true);
            try {
              // Ordem obrigatória: 1) cancelar alerta, 2) remover do repositório,
              // 3) apagar a foto (só se o 2 teve sucesso), 4) recarregar.
              try {
                await NotificacoesService.cancelarAlerta(produto.id);
                await repositorio.remover(produto.id);
              } catch (erro) {
                console.error('[TelaInicial] erro ao remover produto:', erro);
                Alert.alert(
                  'Erro',
                  erro?.message || 'Não foi possível remover o produto. Tente novamente.'
                );
                return;
              }
              await CameraService.removerFoto(produto.fotoUri);
              try {
                setItens(await carregarItens());
                setErroCarga(null);
              } catch (erro) {
                tratarErroCarga(erro);
              }
            } finally {
              setRemovendo(false);
            }
          },
        },
      ]);
    },
    [removendo, tratarErroCarga]
  );

  const resumo = useMemo(() => resumirProdutos(itens.map(({ produto }) => produto)), [itens]);

  const itensVisiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    return itens.filter(
      ({ produto, situacao }) =>
        (filtro === 'todas' || situacao === filtro) && normalizar(produto.nome).includes(termo)
    );
  }, [itens, busca, filtro]);

  if (carregando) {
    return (
      <View style={[estilosBase.tela, styles.centro]}>
        <ActivityIndicator size="large" color={cores.primaria} />
      </View>
    );
  }

  // Banner de sincronização (some sozinho quando a fila esvazia) e puxar para
  // atualizar: presentes também na lista vazia — ex.: o último produto foi
  // removido offline e a remoção ainda aguarda conexão.
  const indicador = (
    <IndicadorSincronizacao
      pendentes={pendentes}
      sincronizando={sincronizando}
      aoSincronizar={sincronizarRepositorio}
    />
  );
  const controleAtualizacao = (
    <RefreshControl
      refreshing={atualizandoPelaLista}
      onRefresh={atualizarPelaLista}
      colors={[cores.primaria]}
      tintColor={cores.primaria}
    />
  );

  if (erroCarga || itens.length === 0) {
    return (
      <View style={estilosBase.tela}>
        {indicador}
        <ScrollView
          contentContainerStyle={styles.centroRolavel}
          refreshControl={controleAtualizacao}
          keyboardShouldPersistTaps="handled"
        >
          {erroCarga ? (
            <EmptyState icone="⚠️" mensagem="Falha ao carregar os produtos" descricao={erroCarga} />
          ) : (
            <EmptyState textoAcao="+ Adicionar produto" onAcao={abrirCadastro} />
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={estilosBase.tela}>
      {indicador}
      <View style={styles.topo}>
        <PainelDashboard resumo={resumo} onSelecionar={setFiltro} />
        <TextInput
          style={estilosBase.campo}
          placeholder="Buscar por nome"
          placeholderTextColor={cores.textoSecundario}
          value={busca}
          onChangeText={setBusca}
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtros}
          keyboardShouldPersistTaps="handled"
        >
          {FILTROS.map(({ chave, rotulo }) => {
            const ativo = filtro === chave;
            const cor = situacoes[chave]?.cor ?? cores.primaria;
            return (
              <TouchableOpacity
                key={chave}
                onPress={() => setFiltro(chave)}
                style={[styles.chip, ativo && { backgroundColor: cor, borderColor: cor }]}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
              >
                <Text style={[styles.textoChip, ativo && styles.textoChipAtivo]}>{rotulo}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={itensVisiveis}
        keyExtractor={({ produto }) => produto.id}
        renderItem={({ item }) => (
          <ProdutoCard
            produto={item.produto}
            situacao={item.situacao}
            onRemover={confirmarRemocao}
            onPress={abrirDetalhe}
            onEditar={abrirEdicao}
          />
        )}
        contentContainerStyle={styles.lista}
        refreshControl={controleAtualizacao}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <EmptyState
            icone="🔍"
            mensagem="Nenhum produto encontrado"
            descricao="Tente outro nome ou outro filtro."
          />
        }
      />
    </View>
  );
}

function criarEstilos(cores) {
  return StyleSheet.create({
    centro: {
      justifyContent: 'center',
    },
    centroRolavel: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    acoesCabecalho: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    areaBotaoCabecalho: {
      paddingVertical: espacamento.sm,
      paddingHorizontal: espacamento.sm,
    },
    botaoCabecalho: {
      // Sobre o cabeçalho da navegação (não sobre um botão primário).
      color: cores.textoCabecalho,
      fontSize: fonte.normal,
      fontWeight: 'bold',
    },
    topo: {
      paddingHorizontal: espacamento.md,
      paddingTop: espacamento.md,
    },
    filtros: {
      paddingVertical: espacamento.sm,
      gap: espacamento.sm,
    },
    chip: {
      borderWidth: 1,
      borderColor: cores.borda,
      backgroundColor: cores.superficie,
      borderRadius: raio.pill,
      paddingHorizontal: espacamento.md,
      paddingVertical: 6,
    },
    textoChip: {
      fontSize: fonte.pequena,
      color: cores.texto,
    },
    textoChipAtivo: {
      color: cores.textoInverso,
      fontWeight: 'bold',
    },
    lista: {
      paddingHorizontal: espacamento.md,
      paddingBottom: espacamento.xl,
    },
  });
}
