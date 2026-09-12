import axios from 'axios';

// Базовый URL нашего Django бэкенда
const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/',
});

// Перехватчик запросов: срабатывает ПЕРЕД отправкой каждого запроса
api.interceptors.request.use(
  (config) => {
    // Достаем токен из памяти браузера
    const token = localStorage.getItem('access');
    
    // Если токен есть, прикрепляем его как Bearer
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;