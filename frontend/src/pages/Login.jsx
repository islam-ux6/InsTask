import { useState } from 'react';
import api from '../api';
import { useTranslation } from 'react-i18next';

const loginTranslations = {
  ru: {
    title: 'ERP System',
    subtitle: 'Вход в систему управления институтом',
    username: 'Имя пользователя',
    password: 'Пароль',
    submit: 'Войти',
    error: 'Неверный логин или пароль'
  },
  tk: {
    title: 'ERP System',
    subtitle: 'Institut dolandyryş ulgamyna giriş',
    username: 'Ulanyjy ady',
    password: 'Açar söz',
    submit: 'Girmek',
    error: 'Ulanyjy ady ýa-da açar söz nädogry'
  },
  en: {
    title: 'ERP System',
    subtitle: 'Sign in to Institute Management System',
    username: 'Username',
    password: 'Password',
    submit: 'Sign In',
    error: 'Invalid username or password'
  }
};

export default function Login() {
  const { i18n } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const lang = loginTranslations[i18n.language] ? i18n.language : 'ru';
  const tr = loginTranslations[lang];

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await api.post('/token/', {
        username,
        password
      });
      
      localStorage.setItem('access', response.data.access);
      localStorage.setItem('refresh', response.data.refresh);
      
      window.location.href = '/';
    } catch (err) {
      setError(tr.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 relative">
        <div className="flex justify-end mb-4">
          <select
            value={lang}
            onChange={(e) => changeLanguage(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg p-1.5 cursor-pointer outline-none"
          >
            <option value="ru">Русский</option>
            <option value="tk">Türkmen</option>
            <option value="en">English</option>
          </select>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700">{tr.title}</h1>
          <p className="text-gray-500 mt-2 text-sm">{tr.subtitle}</p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-6 text-sm text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{tr.username}</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{tr.password}</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              required
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl transition duration-200 shadow-md"
          >
            {tr.submit}
          </button>
        </form>
      </div>
    </div>
  );
}