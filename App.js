import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import TelaInicial from './app/TelaInicial';
import TelaCadastro from './app/TelaCadastro';
import TelaDetalhe from './app/TelaDetalhe';
import TelaLogin from './app/TelaLogin';
import AuthService from './services/AuthService';
import { ThemeProvider, useTema } from './theme/ThemeContext';
import { espacamento, fonte } from './theme/theme';

const Stack = createNativeStackNavigator();

/** Raiz do app: o ThemeProvider (TEMA-01) envolve toda a navegação. */
export default function App() {
  return (
    <ThemeProvider>
      <Navegacao />
    </ThemeProvider>
  );
}

/** Botão do cabeçalho que alterna entre o tema claro e o escuro (TEMA-01). */
function BotaoAlternarTema() {
  const { escuro, alternarTema, cores } = useTema();
  return (
    <TouchableOpacity
      onPress={alternarTema}
      accessibilityRole="button"
      accessibilityLabel={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={styles.botaoTema}
    >
      <Text style={[styles.iconeTema, { color: cores.textoCabecalho }]}>{escuro ? '☀️' : '🌙'}</Text>
    </TouchableOpacity>
  );
}

/**
 * Navegação (APP-07). Ao abrir, lê a sessão local (sem rede) e escolhe qual
 * conjunto de telas mostrar. Os dois conjuntos são filhos mutuamente
 * exclusivos do mesmo Stack.Navigator: quando `autenticado` muda, o React
 * Navigation troca as rotas e zera o histórico, então o "voltar" nunca leva
 * de volta ao login depois de autenticar (sem navigation.reset() manual).
 * As cores do cabeçalho e do fundo seguem o tema ativo (TEMA-01).
 */
function Navegacao() {
  const tema = useTema();
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [autenticado, setAutenticado] = useState(false);

  useEffect(() => {
    let ativo = true;
    AuthService.obterSessao()
      .then((sessao) => {
        if (ativo) setAutenticado(Boolean(sessao));
      })
      .finally(() => {
        if (ativo) setVerificandoSessao(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const aoAutenticar = useCallback(() => setAutenticado(true), []);
  const aoDeslogar = useCallback(() => setAutenticado(false), []);

  // Quando a sincronização recebe 401, a sessão é considerada expirada.
  const aoSessaoExpirada = useCallback(() => {
    setAutenticado(false);
    Alert.alert(
      'Sessão expirada',
      'Sua sessão expirou. Entre novamente para sincronizar as alterações.'
    );
  }, []);

  // Tema do NavigationContainer: evita fundo claro nas transições do tema escuro.
  const temaNavegacao = useMemo(() => {
    const base = tema.escuro ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: tema.cores.primaria,
        background: tema.cores.fundo,
        card: tema.cores.cabecalho,
        text: tema.cores.textoCabecalho,
        border: tema.cores.borda,
        notification: tema.cores.erro,
      },
    };
  }, [tema]);

  // Espera a sessão e a preferência de tema, para não piscar a tela ou o tema errado.
  if (verificandoSessao || tema.carregando) {
    return (
      <View style={[tema.estilosBase.tela, styles.centro]}>
        <ActivityIndicator size="large" color={tema.cores.primaria} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={temaNavegacao}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: tema.cores.cabecalho },
          headerTintColor: tema.cores.textoCabecalho,
          contentStyle: { backgroundColor: tema.cores.fundo },
          headerRight: () => <BotaoAlternarTema />,
        }}
      >
        {autenticado ? (
          <>
            <Stack.Screen name="Inicial" options={{ title: 'Controle de Validade' }}>
              {(props) => (
                <TelaInicial
                  {...props}
                  aoDeslogar={aoDeslogar}
                  aoSessaoExpirada={aoSessaoExpirada}
                  BotaoTema={BotaoAlternarTema}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Cadastro" component={TelaCadastro} options={{ title: 'Cadastrar produto' }} />
            <Stack.Screen name="TelaDetalhe" component={TelaDetalhe} options={{ title: 'Detalhes do produto' }} />
          </>
        ) : (
          <Stack.Screen name="Login" options={{ headerShown: false }}>
            {() => <TelaLogin aoAutenticar={aoAutenticar} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centro: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  botaoTema: {
    paddingVertical: espacamento.sm,
    paddingHorizontal: espacamento.sm,
  },
  iconeTema: {
    fontSize: fonte.media,
  },
});
