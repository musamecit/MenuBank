import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';

let version = '?';
let buildNumber = '?';
try {
  const Constants = require('expo-constants').default;
  version = Constants?.expoConfig?.version ?? '?';
  buildNumber = Constants?.expoConfig?.ios?.buildNumber ?? Constants?.expoConfig?.android?.versionCode ?? '?';
} catch (_) {}

function redactSecrets(s: string): string {
  return s
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/\u0065yJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT]')
    .replace(/sk_[A-Za-z0-9]+/g, '[SECRET]')
    .replace(/sb_publishable_[A-Za-z0-9]+/g, '[ANON_KEY]')
    .replace(/https?:\/\/[^/]+@[^\s]+/g, (m) => m.replace(/@[^\s]+/, '@[REDACTED]'));
}

function getStackLines(error: Error, maxLines = 10): string[] {
  const stack = error?.stack ?? '';
  const lines = stack.split('\n').filter(Boolean);
  return lines.slice(0, maxLines).map((l) => redactSecrets(l.trim()));
}

type Props = { error: Error };

export default function CrashScreen({ error }: Props) {
  const message = redactSecrets(error?.message ?? 'Unknown error');
  const stackLines = getStackLines(error);

  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <StatusBar style="light" />
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>
        MenuBank Crash
      </Text>
      <ScrollView style={{ width: '100%', maxHeight: 400 }} contentContainerStyle={{ paddingVertical: 8 }}>
        <Text style={{ color: '#a3a3a3', fontSize: 14, marginBottom: 12 }}>{message}</Text>
        {stackLines.length > 0 && (
          <Text style={{ color: '#737373', fontSize: 11, fontFamily: 'monospace' }}>
            {stackLines.join('\n')}
          </Text>
        )}
      </ScrollView>
      <Text style={{ color: '#525252', fontSize: 12, marginTop: 24 }}>
        v{version} ({buildNumber})
      </Text>
    </View>
  );
}
