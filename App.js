import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import TelaInicial from './app/TelaInicial';
import TelaCadastro from './app/TelaCadastro';
import TelaTesteCamera from './app/TelaTesteCamera';
import TelaTesteNotificacoes from './app/TelaTesteNotificacoes';
import TelaTesteServicoValidade from './app/TelaTesteServicoValidade';
import { cores } from './components/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Inicial"
        screenOptions={{
          headerStyle: { backgroundColor: cores.primaria },
          headerTintColor: cores.textoInverso,
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
        <Stack.Screen name="Inicial" component={TelaInicial} options={{ title: 'Controle de Validade' }} />
        <Stack.Screen name="Cadastro" component={TelaCadastro} options={{ title: 'Cadastrar produto' }} />
        <Stack.Screen name="TesteCamera" component={TelaTesteCamera} options={{ title: 'Teste CameraService' }} />
        <Stack.Screen name="TesteNotificacoes" component={TelaTesteNotificacoes} options={{ title: 'Teste Notificacoes' }} />
        <Stack.Screen name="TesteServicoValidade" component={TelaTesteServicoValidade} options={{ title: 'Teste ServicoValidade' }} />
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}
