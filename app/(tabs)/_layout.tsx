import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function TabLayout() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#121212' : '#fff';
  const borderColor = isDark ? '#333' : '#f0f0f0';
  const activeColor = '#A00020'; // Bordo always
  const inactiveColor = isDark ? '#888' : '#999';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          height: 60,
          paddingBottom: 5,
          paddingTop: 5,
          backgroundColor: bgColor,
          borderTopWidth: 1,
          borderTopColor: borderColor,
        },
      }}
    >
      {/* 1. HOME (Ev) */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Ev',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />

      {/* 2. DISCOVER (Keşfet) */}
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Keşfet',
          tabBarIcon: ({ color }) => <Ionicons name="compass" size={24} color={color} />,
        }}
      />

      {/* 3. TRACKING (Kişisel Takip) */}
      <Tabs.Screen
        name="tracking"
        options={{
          title: 'Takip',
          tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={24} color={color} />,
        }}
      />

      {/* 4. DIETITIAN (Diyetisyen) */}
      <Tabs.Screen
        name="dietitian"
        options={{
          title: 'Diyetisyen',
          tabBarIcon: ({ color }) => <FontAwesome5 name="user-md" size={24} color={color} />,
        }}
      />




      
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />

    </Tabs>
  );
}