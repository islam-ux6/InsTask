import { useState, useEffect } from 'react';
import api from '../api';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Функция для загрузки профиля
    const fetchProfile = async () => {
      try {
        // api автоматически прикрепит наш JWT токен к запросу
        const response = await api.get('/users/me/');
        setUser(response.data);
      } catch (error) {
        console.error("Ошибка при загрузке профиля:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Пока данные грузятся, показываем скелетон/лоадер
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Загрузка профиля...</div>;
  }

  // Если произошла ошибка
  if (!user) {
    return <div className="p-8 text-red-500 text-center">Не удалось загрузить данные пользователя</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Шапка профиля */}
        <header className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-100">
          <h1 className="text-3xl font-bold text-gray-800">
            Добро пожаловать, {user.first_name} {user.last_name}!
          </h1>
          <p className="text-gray-500 text-lg mt-2">
            {user.position_display !== 'Нет административной должности' ? user.position_display : user.teaching_status_display} 
            {user.department_name ? ` | ${user.department_name}` : ''}
          </p>
        </header>

        {/* Карточки функционала (рендерятся в зависимости от роли) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Блок для Ректората */}
          {user.is_rectorate && (
            <div className="bg-purple-600 rounded-xl p-6 text-white shadow-md hover:shadow-lg transition">
              <h2 className="text-xl font-bold mb-2">Институт (Сводка)</h2>
              <p className="text-purple-100 mb-4">Статистика по всем кафедрам и контроль посещаемости.</p>
              <button className="bg-white text-purple-600 px-4 py-2 rounded-lg font-medium text-sm">Открыть аналитику</button>
            </div>
          )}

          {/* Блок для Завкафедры */}
          {user.is_manager && (
            <div className="bg-blue-600 rounded-xl p-6 text-white shadow-md hover:shadow-lg transition">
              <h2 className="text-xl font-bold mb-2">Моя Кафедра</h2>
              <p className="text-blue-100 mb-4">Управление сотрудниками, выдача задач и дисциплина.</p>
              <button className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium text-sm">Перейти к кафедре</button>
            </div>
          )}

          {/* Блок преподавателя (есть у всех, так как у любого могут быть свои задачи) */}
          <div className="bg-green-600 rounded-xl p-6 text-white shadow-md hover:shadow-lg transition">
            <h2 className="text-xl font-bold mb-2">Мои задачи</h2>
            <p className="text-green-100 mb-4">Список ваших поручений и статус их выполнения.</p>
            <button className="bg-white text-green-600 px-4 py-2 rounded-lg font-medium text-sm">Открыть доску задач</button>
          </div>

        </div>
      </div>
    </div>
  );
}