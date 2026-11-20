import { useCallback, useEffect, useState } from 'react';
import { View, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import TelaInicial from './app/TelaInicial';
import TelaCadastro from './app/TelaCadastro';
import TelaDetalhe from './app/TelaDetalhe';
import TelaLogin from './app/TelaLogin';
import AuthService from './services/AuthService';
import { cores, estilosBase } from './theme/theme';

const Stack = createNativeStackNavigator();

/**
 * Raiz do app (APP-07). Ao abrir, lê a sessão local (sem rede) e escolhe qual
 * conjunto de telas mostrar. Os dois conjuntos são filhos mutuamente
 * exclusivos do mesmo Stack.Navigator: quando `autenticado` muda, o React
 * Navigation troca as rotas e zera o histórico, então o "voltar" nunca leva
 * de volta ao login depois de autenticar (sem navigation.reset() manual).
 */
export default function App() {
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

  if (verificandoSessao) {
    return (
      <View style={[estilosBase.tela, styles.centro]}>
        <ActivityIndicator size="large" color={cores.primaria} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: cores.primaria },
          headerTintColor: cores.textoInverso,
          contentStyle: { backgroundColor: cores.fundo },
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
});
