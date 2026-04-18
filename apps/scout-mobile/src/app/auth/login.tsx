import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('ZM');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [continuationToken, setContinuationToken] = useState('');

  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.afrixplore.io';

  const sendOTP = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/scout/v1/auth/otp/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, country }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to send OTP');
      setContinuationToken(data.continuation_token);
      setStep('otp');
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/scout/v1/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otp,
          continuation_token: continuationToken,
          phone_number: phone,
          country,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Invalid OTP');
      await SecureStore.setItemAsync('access_token', data.access_token);
      await SecureStore.setItemAsync('refresh_token', data.refresh_token);
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AfriXplore Scout</Text>
      <Text style={styles.subtitle}>Sign in with your phone number</Text>

      {step === 'phone' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="+260XXXXXXXXX"
            placeholderTextColor="#6B7280"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TouchableOpacity style={styles.button} onPress={sendOTP} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Send Verification Code</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.otpHint}>Enter the 6-digit code sent to {phone}</Text>
          <TextInput
            style={styles.input}
            placeholder="123456"
            placeholderTextColor="#6B7280"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity style={styles.button} onPress={verifyOTP} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Verify & Sign In</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep('phone')}>
            <Text style={styles.backLink}>← Change phone number</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e', padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#9CA3AF', marginBottom: 40 },
  otpHint: { fontSize: 14, color: '#9CA3AF', marginBottom: 16 },
  input: { backgroundColor: '#1f2937', color: '#FFFFFF', borderRadius: 12, padding: 16, fontSize: 18, marginBottom: 16, borderWidth: 1, borderColor: '#374151' },
  button: { backgroundColor: '#F59E0B', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#000', fontWeight: '700', fontSize: 16 },
  backLink: { color: '#9CA3AF', textAlign: 'center' },
});
