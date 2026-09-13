import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Грузим сразу всё, чтобы посчитать аналитику
        const [meRes, tasksRes, usersRes] = await Promise.all([
          api.get('/users/me/'),
          api.get('/tasks/'),
          api.get('/users/').catch(() => ({ data: [] })) // Если нет прав, вернет пустой массив
        ]);
        
        setCurrentUser(meRes.data);
        setAllTasks(tasksRes.data);
        setAllUsers(usersRes.data);
      } catch (error) {
        console.error("Ошибка загрузки дашборда:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center text-gray-500">Сбор аналитики...</div>;
  }

  if (!currentUser) return null;

  // === 1. ОПРЕДЕЛЯЕМ ОБЛАСТЬ ВИДИМОСТИ ДАННЫХ ===
  const isRectorate = currentUser.is_rectorate;
  const isManager = currentUser.is_manager;
  const isAdmin = isRectorate || isManager;

  // Отбираем пользователей для статистики (Ректор - всех, Зав - свою кафедру, Препод - никого)
  const targetUsers = isRectorate 
    ? allUsers 
    : isManager 
      ? allUsers.filter(u => u.department === currentUser.department) 
      : [];

  // Отбираем МОИ ЛИЧНЫЕ задачи (где я исполнитель) для виджета
  const myTasks = allTasks.filter(t => t.assignees.some(a => a.id === currentUser.id));
  const myActiveTasks = myTasks.filter(t => t.status !== 'completed');

  // === 2. СЧИТАЕМ СТАТИСТИКУ (Для управленцев) ===
  let totalStaff = 0, onWorkToday = 0, onVacation = 0, onTime = 0, late = 0;
  let totalTasks = 0, completedTasks = 0, completionRate = 0;

  if (isAdmin) {
    totalStaff = targetUsers.length;
    
    // Посещаемость за СЕГОДНЯ
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    targetUsers.forEach(u => {
      if (u.work_status !== 'working') {
        onVacation += 1;
      } else {
        onWorkToday += 1;
        // Смотрим словарь посещаемости из бэкенда
        if (u.attendance_history && u.attendance_history[dateStr]) {
          const status = u.attendance_history[dateStr].toLowerCase();
          if (status.includes('on_time') || status.includes('ontime')) onTime += 1;
          if (status.includes('late')) late += 1;
        }
      }
    });

    // Статистика по задачам (Ректор - все задачи, Зав - задачи своей кафедры)
    const targetTasks = isRectorate 
      ? allTasks 
      : allTasks.filter(t => t.target_departments.some(d => d.id === currentUser.department) || t.creator.id === currentUser.id);
    
    totalTasks = targetTasks.length;
    completedTasks = targetTasks.filter(t => t.status === 'completed').length;
    completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  }

  return (
    <div className="max-w-7xl mx-auto pb-10 space-y-6">
      
      {/* ШАПКА ДАШБОРДА */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col md:flex-row justify-between items-center md:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            С возвращением, {currentUser.first_name || currentUser.username}!
          </h1>
          <p className="text-gray-500 mt-2 text-lg">
            {currentUser.position_display !== 'Нет административной должности' 
              ? currentUser.position_display 
              : currentUser.teaching_status_display}
            {currentUser.department_name && ` | ${currentUser.department_name}`}
          </p>
        </div>
        
        <div className="flex gap-3">
          <Link to="/tasks" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition shadow-sm">
            Мои задачи {myActiveTasks.length > 0 && <span className="bg-white text-blue-600 px-2 py-0.5 rounded-full text-xs ml-2">{myActiveTasks.length}</span>}
          </Link>
        </div>
      </div>

      {/* АНАЛИТИКА (ТОЛЬКО ДЛЯ РЕКТОРА И ЗАВКАФЕДРЫ) */}
      {isAdmin && (
        <>
          <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">
            {isRectorate ? 'Сводка по институту' : 'Сводка по кафедре'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Карточка: Штат */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl">👥</div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Сотрудники</span>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-800">{totalStaff}</p>
                <p className="text-sm text-gray-500 mt-1">В отпуске / БС: {onVacation}</p>
              </div>
            </div>

            {/* Карточка: Дисциплина (Сегодня) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center text-xl">⏱️</div>
                <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">Дисциплина сегодня</span>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-800">{onTime}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Вовремя. Опоздало: <span className={late > 0 ? 'text-red-500 font-bold' : ''}>{late}</span>
                </p>
              </div>
            </div>

            {/* Карточка: Задачи */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xl">📋</div>
                <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Всего задач</span>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-800">{totalTasks}</p>
                <p className="text-sm text-gray-500 mt-1">Ожидают выполнения: {totalTasks - completedTasks}</p>
              </div>
            </div>

            {/* Карточка: Эффективность */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-xl">📈</div>
                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">Прогресс</span>
              </div>
              <div>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-gray-800">{completionRate}%</p>
                </div>
                {/* Прогресс-бар */}
                <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${completionRate}%` }}></div>
                </div>
              </div>
            </div>

          </div>
        </>
      )}

      {/* НИЖНИЙ БЛОК: Задачи пользователя и Быстрые действия */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        
        {/* Левая часть: Мои актуальные задачи */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-lg">Вам поручено (В работе)</h3>
            <Link to="/tasks" className="text-sm text-blue-600 hover:underline font-medium">Смотреть все &rarr;</Link>
          </div>
          <div className="p-6 flex-1 overflow-y-auto max-h-[350px]">
            {myActiveTasks.length > 0 ? (
              <div className="space-y-4">
                {myActiveTasks.slice(0, 5).map(task => (
                  <Link 
                    key={task.id} 
                    to={`/tasks/${task.id}`}
                    className="block p-4 border border-gray-100 rounded-xl hover:border-blue-300 hover:shadow-md transition group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-gray-800 group-hover:text-blue-600 transition">{task.title}</h4>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded ${
                        task.status === 'created' ? 'bg-gray-100 text-gray-600' :
                        task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        task.status === 'revision' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {task.status_display}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-1">{task.description}</p>
                    <div className="mt-3 flex justify-between items-center text-xs text-gray-400">
                      <span>Дедлайн: {new Date(task.deadline).toLocaleDateString('ru-RU')}</span>
                      <span>Постановщик: {task.creator?.last_name || 'Система'}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                <span className="text-4xl mb-3">🎉</span>
                <p>У вас нет активных задач! Можно выдохнуть.</p>
              </div>
            )}
          </div>
        </div>

        {/* Правая часть: Быстрые переходы */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 mb-4">Быстрые действия</h3>
            <div className="space-y-3">
              <Link to="/profile" className="flex items-center p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition group">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mr-3 group-hover:bg-blue-600 group-hover:text-white transition">👤</div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">Мой профиль</p>
                  <p className="text-xs text-gray-500">Личное дело и посещаемость</p>
                </div>
              </Link>
              
              <Link to="/departments" className="flex items-center p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition group">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mr-3 group-hover:bg-emerald-600 group-hover:text-white transition">🏢</div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">Структура</p>
                  <p className="text-xs text-gray-500">Справочник сотрудников</p>
                </div>
              </Link>

              {isAdmin && (
                <Link to="/tasks" className="flex items-center p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition group">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mr-3 group-hover:bg-purple-600 group-hover:text-white transition">➕</div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">Создать задачу</p>
                    <p className="text-xs text-gray-500">Поручить дело сотруднику</p>
                  </div>
                </Link>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}