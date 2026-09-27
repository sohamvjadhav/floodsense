import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text } from "react-native";

import MapScreen from "./src/screens/MapScreen";
import ListScreen from "./src/screens/ListScreen";
import ReplayScreen from "./src/screens/ReplayScreen";
import AlertsScreen from "./src/screens/AlertsScreen";
import DistrictScreen from "./src/screens/DistrictScreen";
import { NAV_THEME, C } from "./src/theme";

export type RootStackParamList = {
  Tabs: undefined;
  District: { district: string };
};

type TabParamList = {
  Map: undefined;
  Districts: undefined;
  Replay: undefined;
  Alerts: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function TabIcon({ label, active }: { label: string; active: boolean }) {
  return (
    <Text style={{ fontSize: 17, color: active ? C.accent : C.subtle }}>
      {label}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: C.surface },
        headerTintColor: C.fg,
        headerTitleStyle: { fontWeight: "800" },
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor: C.line,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.subtle,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: "FloodSense",
          tabBarIcon: ({ focused }) => <TabIcon label="◍" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="Districts"
        component={ListScreen}
        options={{
          title: "Risk Queue",
          tabBarIcon: ({ focused }) => <TabIcon label="≡" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="Replay"
        component={ReplayScreen}
        options={{
          title: "Event Replay",
          tabBarIcon: ({ focused }) => <TabIcon label="↺" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          title: "WhatsApp Alerts",
          tabBarIcon: ({ focused }) => <TabIcon label="◉" active={focused} />,
        }}
      />
    </Tabs.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={NAV_THEME}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={MainTabs} />
          <Stack.Screen
            name="District"
            component={DistrictScreen}
            options={{ headerShown: false, presentation: "card" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
