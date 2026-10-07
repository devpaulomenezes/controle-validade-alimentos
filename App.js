import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import TelaInicial from './app/TelaInicial';
import TelaCadastro from './app/TelaCadastro';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Inicial">
        <Stack.Screen name="Inicial" component={TelaInicial} options={{ title: 'Controle de Validade' }} />
        <Stack.Screen name="Cadastro" component={TelaCadastro} options={{ title: 'Cadastrar produto' }} />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
