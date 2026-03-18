import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Compass, PlusCircle, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import ExploreScreen from '../screens/ExploreScreen';
import AddMenuScreen from '../screens/AddMenuScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
        },
      }}
    >
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarLabel: t('tabs.explore'),
          tabBarIcon: ({ color, size }) => <Compass size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="AddMenu"
        component={AddMenuScreen}
        options={{
          tabBarLabel: t('tabs.addMenu'),
          tabBarIcon: ({ focused }) => (
            <React.Fragment>
              <PlusCircle
                size={30}
                color="#fff"
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: 24,
                  padding: 8,
                  marginTop: -8,
                }}
              />
            </React.Fragment>
          ),
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
