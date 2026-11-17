import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import TelaInicial from './app/TelaInicial';
import TelaCadastro from './app/TelaCadastro';
import TelaDetalhe from './app/TelaDetalhe';
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
        <Stack.Screen name="TelaDetalhe" component={TelaDetalhe} options={{ title: 'Detalhes do produto' }} />
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}
