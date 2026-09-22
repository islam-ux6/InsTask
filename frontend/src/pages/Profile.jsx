import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [currentUser, setCurrentUser] = useState(null); 
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState('tasks');
  const [taskFilter, setTaskFilter] = useState('all');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [weekParity, setWeekParity] = useState('odd');

  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordData, setRecordData] = useState({ record_type: 'reward', description: '' });
  const [submittingRecord, setSubmittingRecord] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [meRes, tasksRes] = await Promise.all([
          api.get('/users/me/'),
          api.get('/tasks/')
        ]);
        
        setCurrentUser(meRes.data);
        
        let profileData = meRes.data;
        if (id) {
          const userRes = await api.get(`/users/${id}/`);
          profileData = userRes.data;
        }
        setUser(profileData);
        
        const targetUserId = profileData.id;
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

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    setSubmittingRecord(true);
    try {
      await api.post('/records/', {
        user: user.id,
        record_type: recordData.record_type,
        description: recordData.description
      });
      
      setShowRecordModal(false);
      setRecordData({ record_type: 'reward', description: '' });
      
      const updatedUserRes = await api.get(`/users/${user.id}/`);
      setUser(updatedUserRes.data);
    } catch (error) {
      alert('Ошибка при сохранении записи. Проверьте права доступа.');
      console.error(error);
    } finally {
      setSubmittingRecord(false);
    }
  };

  if (loading) return <div className="text-gray-500 p-8 flex justify-center mt-10">Загрузка профиля...</div>;
  if (error) return <div className="text-red-500 p-8 text-center bg-red-50 rounded-lg mx-auto max-w-lg mt-10">{error}</div>;
  if (!user || !currentUser) return <div className="text-red-500 p-8">Ошибка загрузки</div>;

  const rewards = user.records?.filter(r => r.record_type === 'reward') || [];
  const reprimands = user.records?.filter(r => r.record_type === 'reprimand') || [];
  const isMyProfile = !id;

  const canIssueRecords = (currentUser.is_manager || currentUser.is_rectorate) && !isMyProfile;

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let firstDayOfMonth = new Date(year, month, 1).getDay();
  firstDayOfMonth = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 

  const nextMonth = () => setCalendarDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  const formatDate = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const getDayStatus = (day) => {
    const dateStr = formatDate(year, month, day);
    const todayStr = formatDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    const dayOfWeek = new Date(year, month, day).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return 'weekend';
    if (dateStr > todayStr) return 'future';

    if (user.attendance_history && user.attendance_history[dateStr]) {
      const status = user.attendance_history[dateStr].toLowerCase();
      if (status === 'on_time' || status === 'ontime') return 'ontime';
      if (status === 'late') return 'late';
    }

    if (dateStr === todayStr && user.work_status !== 'working') return 'vacation';
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
      case 'empty': return base + "bg-white text-gray-400 border-gray-100"; 
      default: return base + "bg-white border-transparent";
    }
  };

  const displayedTasks = tasks.filter(task => taskFilter === 'all' ? true : task.status === taskFilter);
  const scheduleData = user.schedule || { odd: {}, even: {} };
  const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const currentSchedule = scheduleData[weekParity] || {};

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <h1 className="text-3xl font-bold text-gray-800">
        {isMyProfile ? t('profile.my_profile') : `${t('profile.personnel_file')} ${user.last_name}`}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center relative overflow-hidden">
            <div className={`absolute top-4 right-4 w-3 h-3 rounded-full ${
              user.work_status === 'working' ? 'bg-green-500 animate-pulse' : 
              user.work_status === 'vacation' ? 'bg-blue-400' : 'bg-gray-400'
            }`} title={user.work_status_display || t('profile.unknown')}></div>

            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-full mx-auto flex items-center justify-center text-4xl font-bold mb-4 shadow-md">
              {user.first_name ? user.first_name[0] : user.username[0]}
            </div>
            <h2 className="text-xl font-bold text-gray-800 leading-tight mb-1">
              {user.last_name} {user.first_name}
            </h2>
            <p className="text-gray-500 text-sm mb-4">@{user.username}</p>
            
            <div className="flex flex-col gap-2 px-4">
              <div className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg text-sm font-semibold border border-purple-100">
                {user.teaching_status_display || t('profile.teacher')}
              </div>
              {/* ИСПРАВЛЕНИЕ ДОЛЖНОСТИ */}
              {user.position && user.position !== 'none' && (
                <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-semibold border border-blue-100">
                  {t(`profile.positions.${user.position}`) || user.position_display}
                </div>
              )}
              {user.academic_degree_display && !user.academic_degree_display.includes('Нет') && (
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-semibold border border-emerald-100">
                  {user.academic_degree_display}
                </div>
              )}
            </div>

            {canIssueRecords && (
              <button 
                onClick={() => setShowRecordModal(true)}
                className="w-full mt-5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-2.5 rounded-xl font-bold text-sm hover:shadow-lg transition-all"
              >
                {t('profile.issue_record')}
              </button>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-3 mb-4">{t('profile.current_status')}</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('profile.work_status')}</p>
                <p className={`font-semibold ${user.work_status === 'working' ? 'text-green-600' : 'text-orange-500'}`}>
                  {user.work_status === 'working' ? t('profile.active') : user.work_status_display || t('profile.unknown')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('profile.department')}</p>
                <p className="font-medium text-gray-800">{user.department_name || t('profile.not_specified')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('profile.working_hours')}</p>
                <p className="font-medium text-gray-800">{user.working_hours}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-3 mb-4">{t('profile.contact_info')}</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('profile.phone')}</p>
                {user.phone ? (
                  <a href={`tel:${user.phone}`} className="font-medium text-blue-600 hover:underline">{user.phone}</a>
                ) : <p className="font-medium text-gray-400">{t('profile.not_specified')}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('profile.email')}</p>
                {user.email ? (
                  <a href={`mailto:${user.email}`} className="font-medium text-blue-600 hover:underline">{user.email}</a>
                ) : <p className="font-medium text-gray-400">{t('profile.not_specified')}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('profile.employment_date')}</p>
                <p className="font-medium text-gray-800">
                  {user.employment_date ? new Date(user.employment_date).toLocaleDateString('ru-RU') : t('profile.not_specified')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-sm">{t('profile.attendance')}</h3>
              <div className="flex space-x-2">
                <button onClick={prevMonth} className="text-gray-400 hover:text-gray-800 font-bold px-2 rounded hover:bg-gray-100">&lt;</button>
                <span className="text-sm font-semibold text-gray-700 w-20 text-center">{monthNames[month]} {year}</span>
                <button onClick={nextMonth} className="text-gray-400 hover:text-gray-800 font-bold px-2 rounded hover:bg-gray-100">&gt;</button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 text-[10px] text-gray-500 mb-3 justify-center">
              <span className="flex items-center"><div className="w-2.5 h-2.5 bg-green-200 border border-green-300 rounded-sm mr-1"></div> {t('profile.on_time')}</span>
              <span className="flex items-center"><div className="w-2.5 h-2.5 bg-yellow-200 border border-yellow-300 rounded-sm mr-1"></div> {t('profile.late')}</span>
              <span className="flex items-center"><div className="w-2.5 h-2.5 bg-white border border-gray-200 rounded-sm mr-1"></div> {t('profile.no_data')}</span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                <div key={day} className="text-[10px] font-bold text-gray-400 mb-1">{day}</div>
              ))}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="h-8"></div>)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const status = getDayStatus(day);
                const today = new Date();
                const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();

                return (
                  <div 
                    key={day} 
                    className={`h-8 ${getDayColor(status, isToday)} cursor-default`}
                    title={status === 'ontime' ? t('profile.on_time') : status === 'late' ? t('profile.late') : status === 'empty' ? t('profile.no_data') : ''}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-[500px]">
            <div className="flex border-b border-gray-100 px-2 overflow-x-auto">
              <button onClick={() => setActiveTab('tasks')} className={`px-6 py-4 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'tasks' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>{t('profile.tabs.tasks')} ({tasks.length})</button>
              <button onClick={() => setActiveTab('schedule')} className={`px-6 py-4 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'schedule' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}>{t('profile.tabs.schedule')}</button>
              <button onClick={() => setActiveTab('rewards')} className={`px-6 py-4 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'rewards' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500 hover:bg-gray-50'}`}>{t('profile.tabs.rewards')} ({rewards.length})</button>
              <button onClick={() => setActiveTab('reprimands')} className={`px-6 py-4 text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'reprimands' ? 'border-b-2 border-red-600 text-red-600' : 'text-gray-500 hover:bg-gray-50'}`}>{t('profile.tabs.reprimands')} ({reprimands.length})</button>
            </div>

            <div className="p-6 flex-1 flex flex-col">
              {activeTab === 'schedule' && (
                <div className="flex flex-col h-full animate-fade-in">
                  <div className="flex justify-center mb-6">
                    <div className="bg-gray-100 p-1 rounded-xl flex gap-1 shadow-inner">
                      <button onClick={() => setWeekParity('odd')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${weekParity === 'odd' ? 'bg-white text-indigo-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}>{t('profile.schedule.odd_week')}</button>
                      <button onClick={() => setWeekParity('even')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${weekParity === 'even' ? 'bg-white text-indigo-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}>{t('profile.schedule.even_week')}</button>
                    </div>
                  </div>
                  <div className="space-y-6 overflow-y-auto max-h-[600px] pr-2">
                    {daysOfWeek.map(day => {
                      const dayClasses = currentSchedule[day];
                      if (!dayClasses || dayClasses.length === 0) return null;
                      return (
                        <div key={day} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200"><h4 className="font-bold text-gray-800">{day}</h4></div>
                          <div className="divide-y divide-gray-100">
                            {dayClasses.map((cls, idx) => (
                              <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-gray-50 transition-colors">
                                <div className="min-w-[120px]"><span className="bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-lg text-sm border border-indigo-100">{cls.time}</span></div>
                                <div className="flex-1">
                                  <p className="font-bold text-gray-800">{cls.name}</p>
                                  <div className="flex flex-wrap gap-3 mt-1 text-xs font-medium text-gray-500">
                                    <span className="flex items-center gap-1"><span className="text-gray-400">Тип:</span> {cls.type}</span>
                                    <span className="flex items-center gap-1"><span className="text-gray-400">Группа:</span> {cls.group}</span>
                                    <span className="flex items-center gap-1"><span className="text-gray-400">Ауд:</span> {cls.room}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {daysOfWeek.every(day => !currentSchedule[day] || currentSchedule[day].length === 0) && <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-200 rounded-xl">{t('profile.schedule.empty')}</div>}
                  </div>
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="flex flex-col h-full">
                  <div className="flex flex-wrap gap-2 mb-6">
                    {/* ИСПРАВЛЕНИЕ: ПЕРЕВОД ФИЛЬТРОВ ИСПОЛЬЗУЕТ t() */}
                    {['all', 'created', 'in_progress', 'revision', 'on_review', 'completed'].map(f => (
                      <button key={f} onClick={() => setTaskFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${taskFilter === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {t(`tasks.filters.${f}`)}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3 overflow-y-auto pr-2 max-h-[500px]">
                    {displayedTasks.length > 0 ? displayedTasks.map(task => (
                      <div key={task.id} onClick={() => navigate(`/tasks/${task.id}`)} className="p-4 border border-gray-200 rounded-xl hover:shadow-md hover:border-blue-300 transition cursor-pointer group bg-white flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{task.title}</h4>
                          {/* ИСПРАВЛЕНИЕ СТАТУСА: ИСПОЛЬЗУЕМ I18N ВМЕСТО STATUS_DISPLAY */}
                          <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-gray-100 text-gray-700">
                            {t(`tasks.status.${task.status}`)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2">{task.description}</p>
                      </div>
                    )) : <div className="text-center text-gray-400 py-10 border-2 border-dashed border-gray-100 rounded-xl">{t('tasks.not_found')}</div>}
                  </div>
                </div>
              )}

              {activeTab === 'rewards' && (
                <div className="space-y-3 overflow-y-auto max-h-[500px]">
                  {rewards.map(r => (
                    <div key={r.id} className="p-4 border-l-4 border-green-500 bg-green-50/50 rounded-r-xl">
                      <p className="font-bold text-green-800 mb-1">{r.description}</p>
                      <p className="text-xs text-green-600">{t('profile.records.issued')} {new Date(r.created_at).toLocaleDateString('ru-RU')} | {t('profile.records.author')} {r.author_name}</p>
                    </div>
                  ))}
                  {rewards.length === 0 && <p className="text-center text-gray-400 py-10">{t('profile.records.empty_rewards')}</p>}
                </div>
              )}

              {activeTab === 'reprimands' && (
                <div className="space-y-3 overflow-y-auto max-h-[500px]">
                  {reprimands.map(r => (
                    <div key={r.id} className="p-4 border-l-4 border-red-500 bg-red-50/50 rounded-r-xl">
                      <p className="font-bold text-red-800 mb-1">{r.description}</p>
                      <p className="text-xs text-red-600">{t('profile.records.issued')} {new Date(r.created_at).toLocaleDateString('ru-RU')} | {t('profile.records.author')} {r.author_name}</p>
                    </div>
                  ))}
                  {reprimands.length === 0 && <p className="text-center text-green-600 font-medium py-10">{t('profile.records.empty_reprimands')}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showRecordModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-lg">{t('profile.modal.title')}</h3>
              <button onClick={() => setShowRecordModal(false)} className="text-gray-400 hover:text-gray-800 text-2xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleCreateRecord} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t('profile.modal.type')}</label>
                <select 
                  value={recordData.record_type} 
                  onChange={(e) => setRecordData({...recordData, record_type: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                >
                  <option value="reward">{t('profile.modal.reward')}</option>
                  <option value="reprimand">{t('profile.modal.reprimand')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t('profile.modal.reason')}</label>
                <textarea 
                  required
                  rows="4" 
                  placeholder={t('profile.modal.placeholder')}
                  value={recordData.description} 
                  onChange={(e) => setRecordData({...recordData, description: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                ></textarea>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={submittingRecord}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors shadow-md"
                >
                  {submittingRecord ? t('profile.modal.save') : t('profile.modal.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}