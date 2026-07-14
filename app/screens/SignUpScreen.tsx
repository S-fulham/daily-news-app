import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export default function SignUpScreen({ navigation }: Props) {
  const { signUpWithEmail, signInWithOAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert('Check your details', 'Enter an email and a password with at least 6 characters.');
      return;
    }
    setLoading(true);
    const { error } = await signUpWithEmail(email.trim(), password);
    setLoading(false);
    if (error) Alert.alert('Sign up failed', error);
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    const { error } = await signInWithOAuth(provider);
    if (error) Alert.alert('Sign in failed', error);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.subtitle}>Neutral news synthesis, every day.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.primaryButton} onPress={handleSignUp} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sign up</Text>}
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.divider} />
      </View>

      <Pressable style={styles.oauthButton} onPress={() => handleOAuth('google')}>
        <Text style={styles.oauthButtonText}>Continue with Google</Text>
      </Pressable>
      <Pressable style={styles.oauthButton} onPress={() => handleOAuth('apple')}>
        <Text style={styles.oauthButtonText}>Continue with Apple</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('Login')}>
        <Text style={styles.linkText}>Already have an account? Log in</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: '#e2e2e2' },
  dividerText: { marginHorizontal: 10, color: '#999' },
  oauthButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  oauthButtonText: { fontSize: 15, fontWeight: '500' },
  linkText: { textAlign: 'center', marginTop: 20, color: '#555' },
});
