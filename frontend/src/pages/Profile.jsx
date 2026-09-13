import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState('tasks');
  const [taskFilter, setTaskFilter] = useState('all');
  const [calendarDate, setCalendarDate] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const userEndpoint = id ? `/users/${id}/` : '/users/me/';
        const [userRes, tasksRes] = await Promise.all([
          api.get(userEndpoint),
          api.get('/tasks/')
        ]);
        
        setUser(userRes.data);
        const targetUserId = userRes.data.id;
        const myAssignedTasks = tasksRes.data.filter(task => 
          task.assignees.some(assignee => assignee.id === targetUserId)
        );
        setTasks(myAssignedTasks);
        
      } catch (error) {
        console.error("Ошибка", error);
        setError('Не удалось загрузить профиль. Возможно, у вас нет прав доступа.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return <div className="text-gray-500 p-8 flex justify-center mt-10">Загрузка профиля...</div>;
  if (error) return <div className="text-red-500 p-8 text-center bg-red-50 rounded-lg mx-auto max-w-lg mt-10">{error}</div>;
  if (!user) return <div className="text-red-500 p-8">Ошибка загрузки</div>;

  const rewards = user.records?.filter(r => r.record_type === 'reward') || [];
  const reprimands = user.records?.filter(r => r.record_type === 'reprimand') || [];

  const displayedTasks = tasks.filter(task => {
    if (taskFilter === 'all') return true;
    return task.status === taskFilter;
  });

  const isMyProfile = !id;

  // === ЛОГИКА КАЛЕНДАРЯ ===
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let firstDayOfMonth = new Date(year, month, 1).getDay();
  firstDayOfMonth = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 

  const nextMonth = () => setCalendarDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  // Хелпер для форматирования даты в "YYYY-MM-DD"
  const formatDate = (y, m, d) => {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  // === РЕАЛЬНЫЕ ДАННЫЕ С БЭКЕНДА ===
  const getDayStatus = (day) => {
    const dateStr = formatDate(year, month, day);
    const today = new Date();
    const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

    // 1. Выходные всегда серые
    const dayOfWeek = new Date(year, month, day).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return 'weekend';

    // 2. Дни в будущем - пустые
    if (dateStr > todayStr) return 'future';

    // 3. Проверяем историю из базы данных
    if (user.attendance_history && user.attendance_history[dateStr]) {
      const status = user.attendance_history[dateStr].toLowerCase();
      if (status === 'on_time' || status === 'ontime') return 'ontime';
      if (status === 'late') return 'late';
    }

    // 4. Если сегодня записей нет, но человек в отпуске
    if (dateStr === todayStr && user.work_status !== 'working') {
      return 'vacation';
    }

    // 5. Если записей нет (прогул или система еще не работала)
    return 'empty'; 
  };

  const getDayColor = (status, isToday) => {
    let base = "border rounded flex items-center justify-center text-sm font-medium transition-colors ";
    if (isToday) base += "ring-2 ring-blue-500 ring-offset-1 ";

    switch(status) {
      case 'ontime': return base + "bg-green-100 text-green-700 border-green-200 shadow-sm";
      case 'late': return base + "bg-yellow-100 text-yellow-700 border-yellow-200 shadow-sm";
      case 'vacation': return base + "bg-blue-100 text-blue-700 border-blue-200 shadow-sm";
      case 'future': return base + "bg-white text-gray-300 border-gray-100";
      case 'weekend': return base + "bg-gray-50 text-gray-400 border-transparent";
      case 'empty': return base + "bg-white text-gray-400 border-gray-100"; // Нет данных
      default: return base + "bg-white border-transparent";
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <h1 className="text-3xl font-bold text-gray-800">
        {isMyProfile ? 'Мой профиль' : `Личное дело: ${user.last_name}`}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ЛЕВАЯ КОЛОНКА */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center relative overflow-hidden">
            <div className={`absolute top-4 right-4 w-3 h-3 rounded-full ${
              user.work_status === 'working' ? 'bg-green-500 animate-pulse' : 
              user.work_status === 'vacation' ? 'bg-blue-400' : 'bg-gray-400'
            }`} title={user.work_status_display || 'Статус'}></div>

            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-full mx-auto flex items-center justify-center text-4xl font-bold mb-4 shadow-md">
              {user.first_name ? user.first_name[0] : user.username[0]}
            </div>
            <h2 className="text-xl font-bold text-gray-800 leading-tight mb-1">
              {user.last_name} {user.first_name}
            </h2>
            <p className="text-gray-500 text-sm mb-4">@{user.username}</p>
            
            <div className="flex flex-col gap-2 px-4">
              <div className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg text-sm font-semibold border border-purple-100">
                {user.teaching_status_display || 'Преподаватель'}
              </div>
              {user.position_display !== 'Нет административной должности' && (
                <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-semibold border border-blue-100">
                  {user.position_display}
                </div>
              )}
              {user.academic_degree_display && !user.academic_degree_display.includes('Нет') && (
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-semibold border border-emerald-100">
                  {user.academic_degree_display}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-3 mb-4">Текущее состояние</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Присутствие</p>
                <p className={`font-semibold ${user.work_status === 'working' ? 'text-green-600' : 'text-orange-500'}`}>
                  {user.work_status === 'working' ? 'На работе' : user.work_status_display || 'Неизвестно'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Кафедра</p>
                <p className="font-medium text-gray-800">{user.department_name || 'Не указана'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Рабочие часы</p>
                <p className="font-medium text-gray-800">{user.working_hours}</p>
              </div>
            </div>
          </div>

          {/* КОМПАКТНЫЙ КАЛЕНДАРЬ */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-sm">Посещаемость</h3>
              <div className="flex space-x-2">
                <button onClick={prevMonth} className="text-gray-400 hover:text-gray-800 font-bold px-2 rounded hover:bg-gray-100">&lt;</button>
                <span className="text-sm font-semibold text-gray-700 w-20 text-center">
                  {monthNames[month]} {year}
                </span>
                <button onClick={nextMonth} className="text-gray-400 hover:text-gray-800 font-bold px-2 rounded hover:bg-gray-100">&gt;</button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 text-[10px] text-gray-500 mb-3 justify-center">
              <span className="flex items-center"><div className="w-2.5 h-2.5 bg-green-200 border border-green-300 rounded-sm mr-1"></div> Вовремя</span>
              <span className="flex items-center"><div className="w-2.5 h-2.5 bg-yellow-200 border border-yellow-300 rounded-sm mr-1"></div> Опоздал</span>
              <span className="flex items-center"><div className="w-2.5 h-2.5 bg-white border border-gray-200 rounded-sm mr-1"></div> Нет данных</span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                <div key={day} className="text-[10px] font-bold text-gray-400 mb-1">{day}</div>
              ))}
              
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="h-8"></div>
              ))}
              
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const status = getDayStatus(day);
                const today = new Date();
                const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();

                return (
                  <div 
                    key={day} 
                    className={`h-8 ${getDayColor(status, isToday)} cursor-default`}
                    title={status === 'ontime' ? 'Пришел вовремя' : status === 'late' ? 'Опоздал' : status === 'empty' ? 'Нет данных в базе' : ''}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА (ВКЛАДКИ) */}
        <div className="lg:col-span-2 flex flex-col space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-[500px]">
            <div className="flex border-b border-gray-100 px-2 overflow-x-auto">
              <button onClick={() => setActiveTab('tasks')} className={`px-6 py-4 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'tasks' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                Задания ({tasks.length})
              </button>
              <button onClick={() => setActiveTab('rewards')} className={`px-6 py-4 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'rewards' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                Достижения ({rewards.length})
              </button>
              <button onClick={() => setActiveTab('reprimands')} className={`px-6 py-4 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'reprimands' ? 'border-b-2 border-red-600 text-red-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                Выговоры ({reprimands.length})
              </button>
            </div>

            <div className="p-6 flex-1 flex flex-col">
              {activeTab === 'tasks' && (
                <div className="flex flex-col h-full">
                  <div className="flex flex-wrap gap-2 mb-6">
                    <button onClick={() => setTaskFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${taskFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Все</button>
                    <button onClick={() => setTaskFilter('created')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${taskFilter === 'created' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Созданы</button>
                    <button onClick={() => setTaskFilter('in_progress')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${taskFilter === 'in_progress' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>В работе</button>
                    <button onClick={() => setTaskFilter('revision')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${taskFilter === 'revision' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>На доработке</button>
                    <button onClick={() => setTaskFilter('on_review')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${taskFilter === 'on_review' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'}`}>На проверке</button>
                    <button onClick={() => setTaskFilter('completed')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${taskFilter === 'completed' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>Завершено</button>
                  </div>

                  <div className="space-y-3 overflow-y-auto pr-2 max-h-[500px]">
                    {displayedTasks.length > 0 ? displayedTasks.map(task => (
                      <div key={task.id} onClick={() => navigate(`/tasks/${task.id}`)} className="p-4 border border-gray-200 rounded-xl hover:shadow-md hover:border-blue-300 transition cursor-pointer group bg-white flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{task.title}</h4>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap ${task.status === 'completed' ? 'bg-green-100 text-green-700' : task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : task.status === 'on_review' ? 'bg-yellow-100 text-yellow-700' : task.status === 'revision' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                            {task.status_display}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2">{task.description}</p>
                      </div>
                    )) : (
                      <div className="text-center text-gray-400 py-10 border-2 border-dashed border-gray-100 rounded-xl">
                        Задач с таким статусом не найдено.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'rewards' && (
                <div className="space-y-3 overflow-y-auto max-h-[500px]">
                  {rewards.map(r => (
                    <div key={r.id} className="p-4 border-l-4 border-green-500 bg-green-50/50 rounded-r-xl">
                      <p className="font-bold text-green-800 mb-1">{r.description}</p>
                      <p className="text-xs text-green-600">Выдано: {new Date(r.created_at).toLocaleDateString('ru-RU')} | Автор: {r.author_name}</p>
                    </div>
                  ))}
                  {rewards.length === 0 && <p className="text-center text-gray-400 py-10">Наград пока нет.</p>}
                </div>
              )}

              {activeTab === 'reprimands' && (
                <div className="space-y-3 overflow-y-auto max-h-[500px]">
                  {reprimands.map(r => (
                    <div key={r.id} className="p-4 border-l-4 border-red-500 bg-red-50/50 rounded-r-xl">
                      <p className="font-bold text-red-800 mb-1">{r.description}</p>
                      <p className="text-xs text-red-600">Выдано: {new Date(r.created_at).toLocaleDateString('ru-RU')} | Автор: {r.author_name}</p>
                    </div>
                  ))}
                  {reprimands.length === 0 && <p className="text-center text-green-600 font-medium py-10">Отлично! Выговоров нет.</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}