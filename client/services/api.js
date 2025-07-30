import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventEmitter from 'eventemitter3';

// API configuration - change IP address to match your computer
// You can set this via environment variable or change directly here
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://192.168.100.34:5000/api';
const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add a response interceptor to handle 401 errors globally
export const apiEventEmitter = new EventEmitter();

api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response && error.response.status === 401) {
      await AsyncStorage.removeItem('token');
      apiEventEmitter.emit('logout');
    }
    return Promise.reject(error);
  }
);

export default api;