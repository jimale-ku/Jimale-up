// App.js
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MainScreen from './screens/MainScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import MyListScreen from './screens/MyListScreen';
import TransitionScreen from './screens/TransitionScreen';
import TransitionScreen2 from './screens/TransitionScreen2';
import GroupListScreen from './screens/GroupListScreen';
import GroupDetailScreen from './screens/GroupDetailScreen';
import WhereToBuyScreen from './screens/WhereToBuyScreen';
import SmartSuggestionsScreen from './screens/SmartSuggestionsScreen';
import ProductListScreen from './screens/ProductListScreen';
import { PersonalListProvider } from './services/PersonalListContext';
import GroupSharedListScreen from './screens/GroupSharedListScreen';
import TransitionScreenPersonal from './screens/TransitionScreenPersonal';


const Stack = createStackNavigator();

export default function App() {

  return (
    <PersonalListProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Login">
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }}/>
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="beforeMain" component={TransitionScreen} options={{ headerShown: false }}/>
            <Stack.Screen name="beforeShopping" component={TransitionScreen2} options={{ headerShown: false }}/>
            <Stack.Screen name="Main" component={MainScreen} options={{
    headerTitle: '🛒 Smart Buy',
    headerTitleAlign: 'center',
    headerTitleStyle: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#2E7D32',
    },
  }}/>
            <Stack.Screen name="MyList" component={MyListScreen} />
            <Stack.Screen name="GroupList" component={GroupListScreen} />
            <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
            <Stack.Screen name="WhereToBuy" component={WhereToBuyScreen} />
            <Stack.Screen name="SmartSuggestions" component={SmartSuggestionsScreen} options={{
              headerTitle: '🧠 Smart Suggestions',
              headerTitleAlign: 'center',
              headerTitleStyle: {
                fontSize: 20,
                fontWeight: 'bold',
                color: '#2E7D32',
              },
            }} />
            <Stack.Screen name="ProductListScreen" component={ProductListScreen} />
            <Stack.Screen name="ProductList" component={ProductListScreen} />
            <Stack.Screen name="GroupSharedList" component={GroupSharedListScreen} />
            <Stack.Screen name="TransitionScreenPersonal" component={TransitionScreenPersonal} options={{ headerShown: false }} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </PersonalListProvider>
  );
}

