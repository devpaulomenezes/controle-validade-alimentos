import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import NotificacoesService from '../services/NotificacoesService';
import Produto from '../data/Produto';
import { cores, espacamento, raio, fonte, estilosBase } from '../components/theme';

function gerarDataRelativa(diasOffset) {
  const d = new Date();
  d.setDate(d.getDate() + diasOffset);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export default function TelaTesteNotificacoes({ navigation }) {
  const [agendadas, setAgendadas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  async function atualizarLista() {
    setCarregando(true);
    try {
      const lista = await NotificacoesService.listarAgendadas();
      setAgendadas(lista);
    } catch (err) {
      console.error('Erro ao listar notificações agendadas:', err);
    } finally {
      setCarregando(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      async function carregar() {
        try {
          const lista = await NotificacoesService.listarAgendadas();
          if (ativo) setAgendadas(lista);
        } catch (err) {
          console.error('Erro ao listar notificações agendadas:', err);
        } finally {
          if (ativo) setCarregando(false);
        }
      }
      carregar();
      return () => {
        ativo = false;
      };
    }, [])
  );

  async function testarProduto(nome, diasOffset) {
    const dataDeValidade = gerarDataRelativa(diasOffset);
    const produto = new Produto({
      id: `teste-${Date.now()}`,
      nome,
      quantidade: 1,
      dataDeValidade,
      fotoUri: null,
      dataDeCadastro: new Date().toISOString(),
    });

    const id = await NotificacoesService.agendarAlerta(produto);
    if (id) {
      Alert.alert(
        'Alerta Agendado!',
        `Produto: ${nome}\nValidade: ${dataDeValidade} (${diasOffset > 0 ? `em ${diasOffset} dias` : `há ${Math.abs(diasOffset)} dias`})\n\n${
          diasOffset <= 3
            ? 'Como está dentro da janela de 3 dias, a notificação deve aparecer em cerca de 2 segundos.'
            : 'Como tem folga, a notificação foi agendada para 3 dias antes da validade às 09:00.'
        }`
      );
      await atualizarLista();
    }
  }

  async function handleCancelarTodas() {
    await NotificacoesService.cancelarTodas();
    Alert.alert('Sucesso', 'Todos os agendamentos foram cancelados.');
    await atualizarLista();
  }

  return (
    <ScrollView style={estilosBase.tela} contentContainerStyle={styles.conteudo}>
      <Text style={styles.titulo}>Teste do NotificacoesService</Text>
      <Text style={styles.descricao}>
        Validação isolada da Issue #12: agendamento de alertas locais 3 dias antes do vencimento ou imediato.
      </Text>

      <View style={styles.secaoBotoes}>
        <Text style={estilosBase.rotulo}>Disparar alertas de teste:</Text>

        <TouchableOpacity
          style={[estilosBase.botaoPrimario, styles.botao, styles.botaoAmanha]}
          onPress={() => testarProduto('Iogurte Natural', 1)}
        >
          <Text style={estilosBase.textoBotaoPrimario}>Vence amanhã (alerta em 2s)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[estilosBase.botaoPrimario, styles.botao, styles.botaoVencido]}
          onPress={() => testarProduto('Queijo Minas', -2)}
        >
          <Text style={estilosBase.textoBotaoPrimario}>Já vencido há 2 dias (alerta em 2s)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[estilosBase.botaoPrimario, styles.botao, styles.botaoFolga]}
          onPress={() => testarProduto('Arroz Integral', 10)}
        >
          <Text style={estilosBase.textoBotaoPrimario}>Com folga (+10 dias: agenda p/ futuro)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.secaoLista}>
        <View style={styles.cabecalhoLista}>
          <Text style={estilosBase.rotulo}>
            Agendamentos ativos ({agendadas.length}):
          </Text>
          <TouchableOpacity onPress={atualizarLista} disabled={carregando}>
            <Text style={styles.linkAcao}>Atualizar</Text>
          </TouchableOpacity>
        </View>

        {carregando ? (
          <ActivityIndicator size="small" color={cores.primaria} style={{ marginVertical: espacamento.md }} />
        ) : agendadas.length === 0 ? (
          <View style={styles.cardVazio}>
            <Text style={styles.textoVazio}>Nenhum agendamento futuro ativo no sistema.</Text>
          </View>
        ) : (
          agendadas.map((item, index) => (
            <View key={item.identifier || String(index)} style={styles.cardItem}>
              <Text style={styles.tituloNotif}>{item.content.title}</Text>
              <Text style={styles.corpoNotif}>{item.content.body}</Text>
              <Text style={styles.detalheTrigger}>
                ID: {item.identifier}
              </Text>
            </View>
          ))
        )}

        {agendadas.length > 0 ? (
          <TouchableOpacity style={styles.botaoCancelar} onPress={handleCancelarTodas}>
            <Text style={styles.textoBotaoCancelar}>Cancelar todos os agendamentos</Text>
          </TouchableOpacity>
        ) : null}
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
  secaoBotoes: {
    marginBottom: espacamento.lg,
    gap: espacamento.sm,
  },
  botao: {
    marginVertical: 2,
  },
  botaoAmanha: {
    backgroundColor: '#d97706', // âmbar
  },
  botaoVencido: {
    backgroundColor: cores.erro,
  },
  botaoFolga: {
    backgroundColor: cores.primaria,
  },
  secaoLista: {
    backgroundColor: cores.superficie,
    borderRadius: raio.md,
    borderColor: cores.borda,
    borderWidth: 1,
    padding: espacamento.md,
    marginBottom: espacamento.lg,
  },
  cabecalhoLista: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: espacamento.sm,
  },
  linkAcao: {
    color: cores.primaria,
    fontSize: fonte.pequena,
    fontWeight: 'bold',
  },
  cardVazio: {
    paddingVertical: espacamento.md,
    alignItems: 'center',
  },
  textoVazio: {
    color: cores.textoSecundario,
    fontSize: fonte.pequena,
    fontStyle: 'italic',
  },
  cardItem: {
    backgroundColor: cores.fundo,
    borderRadius: raio.sm,
    padding: espacamento.sm,
    marginBottom: espacamento.xs + 2,
  },
  tituloNotif: {
    fontWeight: 'bold',
    fontSize: fonte.normal,
    color: cores.texto,
  },
  corpoNotif: {
    fontSize: fonte.normal,
    color: cores.textoSecundario,
    marginVertical: 2,
  },
  detalheTrigger: {
    fontSize: fonte.pequena - 2,
    color: cores.textoSecundario,
  },
  botaoCancelar: {
    marginTop: espacamento.md,
    alignItems: 'center',
    paddingVertical: espacamento.sm,
    backgroundColor: '#fee2e2',
    borderRadius: raio.sm,
  },
  textoBotaoCancelar: {
    color: cores.erro,
    fontWeight: 'bold',
    fontSize: fonte.pequena,
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
