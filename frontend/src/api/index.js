import axios from 'axios';

// Убедись, что URL совпадает с твоим бэкендом (скорее всего http://localhost:8000/api)
const API_URL = 'http://localhost:8000/api'; 

const api = axios.create({
  baseURL: API_URL,
});

// === 1. ПЕРЕХВАТЧИК ЗАПРОСОВ ===
// Перед каждым запросом на бэкенд Axios будет брать 'access' токен и прикреплять его
api.interceptors.request.use(
  (config) => {
    // ВАЖНО: берем токен по твоему ключу 'access'
    const token = localStorage.getItem('access'); 
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// === 2. ПЕРЕХВАТЧИК ОТВЕТОВ (ТИХОЕ ОБНОВЛЕНИЕ) ===
// Если бэкенд ответил ошибкой 401 (токен протух), Axios попытается его обновить
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Если ошибка 401 (Unauthorized) и мы еще не пытались обновить токен
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Ставим флаг, чтобы не зациклить запрос

      try {
        // ВАЖНО: берем refresh-токен по твоему ключу 'refresh'
        const refreshToken = localStorage.getItem('refresh'); 
        
        if (refreshToken) {
          // Отправляем запрос на обновление токена
          const res = await axios.post(`${API_URL}/token/refresh/`, {
            refresh: refreshToken
          });

          // Сохраняем новый токен под твоим ключом 'access'
          const newAccessToken = res.data.access;
          localStorage.setItem('access', newAccessToken);

          // Обновляем токен в упавшем запросе и повторяем его
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest); 
        }
      } catch (refreshError) {
        // Если refresh_token тоже протух (или невалиден) — выкидываем на страницу логина
        console.error("Refresh token expired or invalid", refreshError);
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Если это ошибка 401, но refresh-токена вообще не было
    if (error.response && error.response.status === 401) {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;