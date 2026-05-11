import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://api.afrixplore.io';

export const apiClient = {
  async get(path: string, token: string) {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`GET ${path} failed: ${response.status}`);
    return response.json();
  },

  async post(path: string, body: object, token: string) {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`POST ${path} failed: ${response.status}`);
    return response.json();
  },

  async patch(path: string, body: object, token: string) {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`PATCH ${path} failed: ${response.status}`);
    return response.json();
  },

  async uploadFile(path: string, localUri: string, token: string) {
    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) throw new Error(`Upload to ${path} failed: ${response.status}`);
    return response.json();
  },
};
