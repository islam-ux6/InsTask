import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Фотография профиля (работает через сервер + мгновенное хранилище)
  const [avatarPreview, setAvatarPreview] = useState(null);

  // Редактирование контактов
  const [editingContacts, setEditingContacts] = useState(false);
  const [contactForm, setContactForm] = useState({ phone: '', email: '' });
  const [savingContacts, setSavingContacts] = useState(false);

  const [activeTab, setActiveTab] = useState('tasks');
  const [taskFilter, setTaskFilter] = useState('all');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [weekParity, setWeekParity] = useState('odd');

  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordData, setRecordData] = useState({ record_type: 'reward', description: '' });
  const [submittingRecord, setSubmittingRecord] = useState(false);

  // Состояния для конструктора расписания
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [submittingSchedule, setSubmittingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    week_type: 'both',
    day_of_week: 'Понедельник',
    time_slot: '08:30 - 10:00',
    subject_name: '',
    class_type: 'Лекция',
    room: '',
    group: ''
  });

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const dateLocale = i18n.language === 'en' ? 'en-US' : i18n.language === 'tk' ? 'tk-TM' : 'ru-RU';

  const refreshProfileUser = async (targetId) => {
    const endpoint = !id || Number(id) === currentUser?.id ? '/users/me/' : `/users/${targetId}/`;
    const res = await api.get(endpoint);
    setUser(res.data);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [meRes, tasksRes] = await Promise.all([api.get('/users/me/'), api.get('/tasks/')]);

        setCurrentUser(meRes.data);

        let profileData = meRes.data;
        if (id) {
          const userRes = await api.get(`/users/${id}/`);
          profileData = userRes.data;
        }
        setUser(profileData);
        setContactForm({
          phone: profileData.phone || '',
          email: profileData.email || ''
        });

        // Загружаем сохраненную аватарку (из поля avatar БД или из localStorage)
        const savedLocalAvatar = localStorage.getItem(`erp_user_avatar_${profileData.id}`);
        setAvatarPreview(profileData.avatar || savedLocalAvatar || null);

        const targetUserId = profileData.id;
        const myAssignedTasks = tasksRes.data.filter(
          (task) =>
            task.assignees?.some((assignee) => assignee.id === targetUserId) ||
            (profileData.department && task.target_departments?.some((d) => d.id === profileData.department))
        );
        setTasks(myAssignedTasks);
      } catch (err) {
        console.error('Ошибка', err);
        setError('Не удалось загрузить профиль. Возможно, у вас нет прав доступа.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Загрузка и автоматическое сжатие фото на аватарку (квадрат 400x400)
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const size = 400;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Центрированная обрезка под квадрат (object-fit: cover)
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setAvatarPreview(compressedDataUrl);
        localStorage.setItem(`erp_user_avatar_${user.id}`, compressedDataUrl);

        // Если на бэкенде добавлено поле avatar, отправляем файл также на сервер
        try {
          const formData = new FormData();
          formData.append('avatar', file);
          const res = await api.patch(`/users/${user.id}/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          if (res.data?.avatar) {
            setAvatarPreview(res.data.avatar);
          }
        } catch {
          // Если поле avatar в БД еще не мигрировано, аватарка продолжает работать через localStorage
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setAvatarPreview(null);
    localStorage.removeItem(`erp_user_avatar_${user.id}`);
    try {
      await api.patch(`/users/${user.id}/`, { avatar: null });
    } catch {
      // Игнорируем, если поле на бэкенде не подключено
    }
  };

  const handleSaveContacts = async (e) => {
    e.preventDefault();
    setSavingContacts(true);
    try {
      const res = await api.patch(`/users/${user.id}/`, {
        phone: contactForm.phone,
        email: contactForm.email
      });
      setUser(res.data);
      setEditingContacts(false);
    } catch (err) {
      alert('Не удалось обновить контактные данные.');
      console.error(err);
    } finally {
      setSavingContacts(false);
    }
  };

  const handleWorkStatusChange = async (newWorkStatus) => {
    setUpdatingStatus(true);
    try {
      const res = await api.patch(`/users/${user.id}/`, { work_status: newWorkStatus });
      setUser(res.data);
    } catch (err) {
      alert('Ошибка при обновлении статуса сотрудника');
      console.error(err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await api.post('/users/checkin/');
      const updatedRes = await api.get('/users/me/');
      setUser(updatedRes.data);
      setCurrentUser(updatedRes.data);
    } catch (err) {
      alert('Не удалось отметить явку. Проверьте подключение.');
      console.error(err);
    } finally {
      setCheckingIn(false);
    }
  };

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
      await refreshProfileUser(user.id);
    } catch (err) {
      alert('Ошибка при сохранении записи. Проверьте права доступа.');
      console.error(err);
    } finally {
      setSubmittingRecord(false);
    }
  };

  const handleAddScheduleItem = async (e) => {
    e.preventDefault();
    setScheduleError('');
    setSubmittingSchedule(true);
    try {
      await api.post(`/users/${user.id}/schedule/`, scheduleForm);
      setShowScheduleModal(false);
      setScheduleForm({
        ...scheduleForm,
        subject_name: '',
        room: '',
        group: ''
      });
      await refreshProfileUser(user.id);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Ошибка при сохранении расписания.';
      setScheduleError(msg);
    } finally {
      setSubmittingSchedule(false);
    }
  };

  const handleDeleteScheduleItem = async (itemId) => {
    if (!itemId) return;
    if (!window.confirm(t('profile.schedule.delete_confirm'))) return;
    try {
      await api.delete(`/users/${user.id}/schedule/?item_id=${itemId}`);
      await refreshProfileUser(user.id);
    } catch (err) {
      alert('Не удалось удалить занятие.');
      console.error(err);
    }
  };

  if (loading) return <div className="text-gray-500 p-8 flex justify-center mt-10">{t('task_detail.loading')}</div>;
  if (error) return <div className="text-red-500 p-8 text-center bg-red-50 rounded-lg mx-auto max-w-lg mt-10">{error}</div>;
  if (!user || !currentUser) return <div className="text-red-500 p-8">Ошибка загрузки</div>;

  const rewards = user.records?.filter((r) => r.record_type === 'reward') || [];
  const reprimands = user.records?.filter((r) => r.record_type === 'reprimand') || [];
  const isMyProfile = !id || Number(id) === currentUser.id;

  const isSubordinate = (() => {
    if (isMyProfile) return false;
    if (currentUser.is_rectorate) return true;
    if (user.is_rectorate) return false;
    if (['dean', 'deputy_dean'].includes(currentUser.position)) {
      return user.position !== 'dean';
    }
    if (currentUser.position === 'head_of_department') {
      return (
        user.department === currentUser.department &&
        !['dean', 'deputy_dean', 'head_of_department'].includes(user.position)
      );
    }
    return false;
  })();

  const canIssueRecords = isSubordinate;
  const canEditWorkStatus = isMyProfile || isSubordinate;
  const canEditAvatar = isMyProfile || currentUser.is_rectorate;

  const canManageSchedule =
    currentUser.is_rectorate ||
    ['dean', 'deputy_dean'].includes(currentUser.position) ||
    (currentUser.position === 'head_of_department' && currentUser.department === user.department);

  // РАСЧЕТ ПЕРСОНАЛЬНЫХ KPI ПРЕПОДАВАТЕЛЯ
  const completedTasks = tasks.filter((item) => item.status === 'completed');
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const scoredTasks = completedTasks.filter((item) => item.quality_score);
  const avgQuality =
    scoredTasks.length > 0
      ? (scoredTasks.reduce((sum, item) => sum + item.quality_score, 0) / scoredTasks.length).toFixed(1)
      : '—';

  const attendanceEntries = Object.values(user.attendance_history || {});
  const totalOnTime = attendanceEntries.filter((st) => st.toLowerCase() === 'on_time' || st.toLowerCase() === 'ontime').length;
  const totalLate = attendanceEntries.filter((st) => st.toLowerCase() === 'late').length;
  const disciplineRate =
    totalOnTime + totalLate > 0 ? Math.round((totalOnTime / (totalOnTime + totalLate)) * 100) : 100;

  const scheduleData = user.schedule || { odd: {}, even: {} };
  const oddCount = Object.values(scheduleData.odd || {}).reduce((acc, arr) => acc + arr.length, 0);
  const evenCount = Object.values(scheduleData.even || {}).reduce((acc, arr) => acc + arr.length, 0);
  const avgWeeklyClasses = Math.round((oddCount + evenCount) / 2);

  // Календарь посещаемости
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let firstDayOfMonth = new Date(year, month, 1).getDay();
  firstDayOfMonth = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const nextMonth = () => setCalendarDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCalendarDate(new Date(year, month - 1, 1));

  const formatDate = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const todayObj = new Date();
  const todayStr = formatDate(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());
  const isCheckedInToday = Boolean(user.attendance_history && user.attendance_history[todayStr]);

  // Сводка посещаемости за выбранный месяц
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  let monthOnTime = 0;
  let monthLate = 0;
  Object.entries(user.attendance_history || {}).forEach(([dateKey, st]) => {
    if (dateKey.startsWith(monthPrefix)) {
      if (st.toLowerCase() === 'late') monthLate += 1;
      else monthOnTime += 1;
    }
  });

  const getDayStatus = (day) => {
    const dateStr = formatDate(year, month, day);
    const dayOfWeek = new Date(year, month, day).getDay();
    if (dayOfWeek === 0) return 'weekend';
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
    let base = 'border rounded-lg flex items-center justify-center text-xs font-bold transition-all ';
    if (isToday) base += 'ring-2 ring-blue-500 ring-offset-1 ';

    switch (status) {
      case 'ontime':
        return base + 'bg-emerald-100 text-emerald-800 border-emerald-200 shadow-sm';
      case 'late':
        return base + 'bg-amber-100 text-amber-800 border-amber-200 shadow-sm';
      case 'vacation':
        return base + 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm';
      case 'future':
        return base + 'bg-white text-gray-300 border-gray-100';
      case 'weekend':
        return base + 'bg-gray-50 text-gray-300 border-transparent';
      case 'empty':
        return base + 'bg-white text-gray-400 border-gray-100';
      default:
        return base + 'bg-white border-transparent';
    }
  };

  const displayedTasks = tasks.filter((task) => (taskFilter === 'all' ? true : task.status === taskFilter));
  const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const timeSlots = ['08:30 - 10:00', '10:15 - 11:45', '12:00 - 13:30', '14:00 - 15:30', '15:45 - 17:15'];
  const weekdayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const currentSchedule = scheduleData[weekParity] || {};

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* 1. ВЕРХНИЙ БАННЕР ПРОФИЛЯ С АВАТАРКОЙ И БЫСТРЫМИ ДЕЙСТВИЯМИ */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Декоративная обложка */}
        <div className="h-32 sm:h-36 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 relative">
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <div className="absolute top-4 right-6 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border ${
                user.work_status === 'working'
                  ? 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30'
                  : 'bg-amber-500/20 text-amber-100 border-amber-400/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  user.work_status === 'working' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              ></span>
              {t(`profile.work_statuses.${user.work_status}`, { defaultValue: user.work_status_display })}
            </span>
          </div>
        </div>

        {/* Основная полоса с аватаром, ФИО, регалиями и кнопками */}
        <div className="px-6 sm:px-8 pb-6 relative flex flex-col lg:flex-row items-center lg:items-end justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 -mt-14 sm:-mt-16 text-center sm:text-left">
            {/* АВАТАР С ЗАГРУЗКОЙ ФОТО */}
            <div className="relative group shrink-0">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border-4 border-white shadow-xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-4xl font-black">
                {avatarPreview ? (
                  <img src={avatarPreview} alt={user.last_name} className="w-full h-full object-cover" />
                ) : (
                  <span>
                    {user.last_name ? user.last_name[0] : ''}
                    {user.first_name ? user.first_name[0] : user.username[0]}
                  </span>
                )}
              </div>

              {canEditAvatar && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <div className="absolute inset-0 rounded-2xl bg-gray-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 bg-white/95 hover:bg-white text-gray-900 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow transition"
                    >
                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{t('profile.avatar.upload')}</span>
                    </button>

                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="text-[10px] font-bold text-red-200 hover:text-red-100 underline"
                      >
                        {t('profile.avatar.remove')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ФИО, логин и бейджи должностей */}
            <div className="pt-2 sm:pt-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  {user.last_name} {user.first_name}
                </h1>
                <span className="text-sm font-semibold text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-lg">
                  @{user.username}
                </span>
              </div>

              <p className="text-sm font-medium text-gray-500 mt-1">
                {user.department_name || t('profile.not_specified')}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                {user.position && user.position !== 'none' && (
                  <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-xl text-xs font-bold">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {t(`profile.positions.${user.position}`, { defaultValue: user.position_display })}
                  </span>
                )}

                <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-xl text-xs font-bold">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                  {t(`profile.teaching_statuses.${user.teaching_status}`, {
                    defaultValue: user.teaching_status_display || t('profile.teacher')
                  })}
                </span>

                {user.academic_degree && user.academic_degree !== 'none' && (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-xl text-xs font-bold">
                    ★ {t(`profile.academic_degrees.${user.academic_degree}`, { defaultValue: user.academic_degree_display })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Правая группа кнопок в шапке профиля */}
          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            {isMyProfile && (
              <>
                {!isCheckedInToday ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="inline-flex items-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{t('profile.check_in_btn')}</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 py-2.5 px-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{t('profile.checked_in_today')}</span>
                  </div>
                )}
              </>
            )}

            {canIssueRecords && (
              <button
                onClick={() => setShowRecordModal(true)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all"
              >
                <span>{t('profile.issue_record')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. ПАНЕЛЬ КЛЮЧЕВЫХ ПОКАЗАТЕЛЕЙ (4 КАРТОЧКИ KPI) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('profile.kpi.completion')}</span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-gray-900">{completionRate}%</span>
              <span className="text-xs font-bold text-gray-500">
                {completedTasks.length}/{tasks.length} {t('profile.kpi.tasks_count')}
              </span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${completionRate}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('profile.kpi.quality')}</span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center font-black">
              ★
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-gray-900">{avgQuality}</span>
              <span className="text-sm font-bold text-gray-400">/ 5.0</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {scoredTasks.length} {t('profile.kpi.based_on_scores')}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('profile.kpi.discipline')}</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-emerald-600">{disciplineRate}%</span>
              <span className="text-xs font-bold text-gray-500">
                {totalOnTime} / {totalOnTime + totalLate}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{t('profile.kpi.on_time_ratio')}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('profile.kpi.workload')}</span>
            <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-indigo-600">{avgWeeklyClasses}</span>
              <span className="text-xs font-bold text-gray-500">{t('profile.kpi.classes_week')}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{user.working_hours}</p>
          </div>
        </div>
      </div>

      {/* 3. ОСНОВНАЯ СЕТКА: ЛЕВАЯ КОЛОНКА (ШТАТ, КОНТАКТЫ, КАЛЕНДАРЬ) И ПРАВАЯ КОЛОНКА (ВКЛАДКИ) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {/* Блок: Статус в штате и график */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-3 mb-4 text-sm uppercase tracking-wider">
              {t('profile.current_status')}
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 font-semibold mb-1.5">{t('profile.work_status')}</p>
                {canEditWorkStatus ? (
                  <select
                    disabled={updatingStatus}
                    value={user.work_status || 'working'}
                    onChange={(e) => handleWorkStatusChange(e.target.value)}
                    className={`w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition ${
                      user.work_status === 'working' ? 'text-emerald-700 bg-emerald-50/60' : 'text-amber-700 bg-amber-50/60'
                    }`}
                  >
                    <option value="working">{t('profile.work_statuses.working')}</option>
                    <option value="vacation">{t('profile.work_statuses.vacation')}</option>
                    <option value="sick">{t('profile.work_statuses.sick')}</option>
                    <option value="trip">{t('profile.work_statuses.trip')}</option>
                  </select>
                ) : (
                  <p className={`font-bold text-sm ${user.work_status === 'working' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {t(`profile.work_statuses.${user.work_status}`, {
                      defaultValue: user.work_status_display || t('profile.unknown')
                    })}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-50 text-sm">
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">{t('profile.working_hours')}</p>
                  <p className="font-bold text-gray-800">{user.working_hours}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">{t('profile.employment_date')}</p>
                  <p className="font-bold text-gray-800">
                    {user.employment_date
                      ? new Date(user.employment_date).toLocaleDateString(dateLocale)
                      : t('profile.not_specified')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Блок: Контактная информация (с возможностью быстрого редактирования) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">{t('profile.contact_info')}</h3>
              {isMyProfile && !editingContacts && (
                <button
                  type="button"
                  onClick={() => setEditingContacts(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800"
                >
                  {t('profile.contacts_edit.edit_btn')}
                </button>
              )}
            </div>

            {editingContacts ? (
              <form onSubmit={handleSaveContacts} className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">{t('profile.phone')}</label>
                  <input
                    type="text"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">{t('profile.email')}</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingContacts(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100"
                  >
                    {t('profile.contacts_edit.cancel_btn')}
                  </button>
                  <button
                    type="submit"
                    disabled={savingContacts}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {t('profile.contacts_edit.save_btn')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3.5 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-400 font-semibold">{t('profile.phone')}</p>
                    {user.phone ? (
                      <a href={`tel:${user.phone}`} className="font-bold text-gray-800 hover:text-blue-600 transition">
                        {user.phone}
                      </a>
                    ) : (
                      <p className="text-gray-400">{t('profile.not_specified')}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-400 font-semibold">{t('profile.email')}</p>
                    {user.email ? (
                      <a href={`mailto:${user.email}`} className="font-bold text-gray-800 hover:text-blue-600 truncate block transition">
                        {user.email}
                      </a>
                    ) : (
                      <p className="text-gray-400">{t('profile.not_specified')}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Блок: Календарь посещаемости со статистикой за месяц */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">{t('profile.attendance')}</h3>
              <div className="flex space-x-1 items-center bg-gray-50 border border-gray-200 rounded-xl px-2 py-1">
                <button onClick={prevMonth} className="text-gray-500 hover:text-gray-900 font-bold px-1.5 rounded">
                  &lt;
                </button>
                <span className="text-xs font-bold text-gray-700 w-24 text-center">
                  {t(`profile.calendar.months.${month}`)} {year}
                </span>
                <button onClick={nextMonth} className="text-gray-500 hover:text-gray-900 font-bold px-1.5 rounded">
                  &gt;
                </button>
              </div>
            </div>

            {/* Сводка за выбранный месяц */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl px-3 py-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-700">{t('profile.on_time')}</span>
                <span className="text-sm font-black text-emerald-800">{monthOnTime}</span>
              </div>
              <div className="bg-amber-50/70 border border-amber-100 rounded-xl px-3 py-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-700">{t('profile.late')}</span>
                <span className="text-sm font-black text-amber-800">{monthLate}</span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center">
              {weekdayKeys.map((dayKey) => (
                <div key={dayKey} className="text-[10px] font-bold text-gray-400 mb-1">
                  {t(`profile.calendar.weekdays_short.${dayKey}`)}
                </div>
              ))}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="h-8"></div>
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const status = getDayStatus(day);
                const isToday =
                  year === todayObj.getFullYear() && month === todayObj.getMonth() && day === todayObj.getDate();

                return (
                  <div
                    key={day}
                    className={`h-8 ${getDayColor(status, isToday)} cursor-default`}
                    title={
                      status === 'ontime'
                        ? t('profile.on_time')
                        : status === 'late'
                        ? t('profile.late')
                        : status === 'empty'
                        ? t('profile.no_data')
                        : ''
                    }
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА: ВКЛАДКИ (ЗАДАНИЯ, РАСПИСАНИЕ, ДОСТИЖЕНИЯ, ВЫГОВОРЫ) */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-[560px] overflow-hidden">
            <div className="flex border-b border-gray-100 px-3 bg-gray-50/50 overflow-x-auto">
              <button
                onClick={() => setActiveTab('tasks')}
                className={`px-5 py-4 text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'tasks' ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>{t('profile.tabs.tasks')}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{tasks.length}</span>
              </button>

              <button
                onClick={() => setActiveTab('schedule')}
                className={`px-5 py-4 text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'schedule'
                    ? 'border-b-2 border-indigo-600 text-indigo-600 bg-white'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>{t('profile.tabs.schedule')}</span>
              </button>

              <button
                onClick={() => setActiveTab('rewards')}
                className={`px-5 py-4 text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'rewards'
                    ? 'border-b-2 border-emerald-600 text-emerald-600 bg-white'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>{t('profile.tabs.rewards')}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{rewards.length}</span>
              </button>

              <button
                onClick={() => setActiveTab('reprimands')}
                className={`px-5 py-4 text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'reprimands'
                    ? 'border-b-2 border-red-600 text-red-600 bg-white'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>{t('profile.tabs.reprimands')}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">{reprimands.length}</span>
              </button>
            </div>

            <div className="p-6 flex-1 flex flex-col">
              {/* ВКЛАДКА 1: ЗАДАНИЯ */}
              {activeTab === 'tasks' && (
                <div className="flex flex-col h-full">
                  <div className="flex flex-wrap gap-2 mb-5">
                    {['all', 'created', 'in_progress', 'revision', 'on_review', 'completed'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setTaskFilter(f)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                          taskFilter === f ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {t(`tasks.filters.${f}`)}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3 overflow-y-auto pr-1 max-h-[540px] custom-scrollbar">
                    {displayedTasks.length > 0 ? (
                      displayedTasks.map((task) => {
                        const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';
                        return (
                          <div
                            key={task.id}
                            onClick={() => navigate(`/tasks/${task.id}`)}
                            className={`p-4 border rounded-2xl hover:shadow-md transition cursor-pointer group bg-white flex flex-col gap-2 ${
                              isOverdue ? 'border-red-200 bg-red-50/20' : 'border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-3">
                              <h4 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                                {task.title}
                              </h4>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {task.quality_score && (
                                  <span className="text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full">
                                    ★ {task.quality_score}/5
                                  </span>
                                )}
                                <span
                                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                                    task.status === 'completed'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : task.status === 'in_progress'
                                      ? 'bg-blue-100 text-blue-700'
                                      : task.status === 'revision'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {t(`tasks.status.${task.status}`)}
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{task.description}</p>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs text-gray-400 font-medium">
                              <span>
                                {t('tasks.card.creator')}:{' '}
                                <strong className="text-gray-700">
                                  {task.creator?.last_name} {task.creator?.first_name}
                                </strong>
                              </span>
                              <span className={isOverdue ? 'text-red-600 font-bold' : 'text-gray-500 font-semibold'}>
                                {new Date(task.deadline).toLocaleDateString(dateLocale, {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-100 rounded-2xl">
                        {t('tasks.not_found')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ВКЛАДКА 2: РАСПИСАНИЕ ПАР */}
              {activeTab === 'schedule' && (
                <div className="flex flex-col h-full animate-fade-in">
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                    <div className="bg-gray-100 p-1 rounded-xl flex gap-1 shadow-inner">
                      <button
                        onClick={() => setWeekParity('odd')}
                        className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                          weekParity === 'odd' ? 'bg-white text-indigo-600 shadow' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {t('profile.schedule.odd_week')}
                      </button>
                      <button
                        onClick={() => setWeekParity('even')}
                        className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                          weekParity === 'even' ? 'bg-white text-indigo-600 shadow' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {t('profile.schedule.even_week')}
                      </button>
                    </div>

                    {canManageSchedule && (
                      <button
                        onClick={() => {
                          setScheduleError('');
                          setShowScheduleModal(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm shrink-0"
                      >
                        {t('profile.schedule.add_btn')}
                      </button>
                    )}
                  </div>

                  <div className="space-y-5 overflow-y-auto max-h-[540px] pr-1 custom-scrollbar">
                    {daysOfWeek.map((day) => {
                      const dayClasses = currentSchedule[day];
                      if (!dayClasses || dayClasses.length === 0) return null;
                      return (
                        <div key={day} className="border border-gray-200 rounded-2xl overflow-hidden">
                          <div className="bg-gray-50 px-5 py-2.5 border-b border-gray-200 flex justify-between items-center">
                            <h4 className="font-bold text-gray-800 text-sm">
                              {t(`profile.schedule.days.${day}`, { defaultValue: day })}
                            </h4>
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                              {dayClasses.length}
                            </span>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {dayClasses.map((cls, idx) => (
                              <div
                                key={cls.id || idx}
                                className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-gray-50/80 transition-colors"
                              >
                                <div className="min-w-[130px]">
                                  <span className="bg-indigo-50 text-indigo-700 font-bold px-3 py-1.5 rounded-xl text-xs border border-indigo-100 inline-block">
                                    {cls.time}
                                  </span>
                                </div>
                                <div className="flex-1">
                                  <p className="font-bold text-gray-900 text-sm">{cls.name}</p>
                                  <div className="flex flex-wrap gap-2 mt-1.5 text-xs font-semibold">
                                    <span className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-md">
                                      {cls.type}
                                    </span>
                                    <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md">
                                      {t('profile.schedule.group')} {cls.group}
                                    </span>
                                    <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-md">
                                      {t('profile.schedule.room')} {cls.room}
                                    </span>
                                  </div>
                                </div>
                                {canManageSchedule && cls.id && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteScheduleItem(cls.id)}
                                    className="text-gray-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-colors self-end sm:self-center"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {daysOfWeek.every((day) => !currentSchedule[day] || currentSchedule[day].length === 0) && (
                      <div className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-200 rounded-2xl">
                        {t('profile.schedule.empty')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ВКЛАДКА 3: ДОСТИЖЕНИЯ */}
              {activeTab === 'rewards' && (
                <div className="space-y-3 overflow-y-auto max-h-[540px]">
                  {rewards.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 border border-emerald-200 bg-emerald-50/40 rounded-2xl flex items-start gap-3.5"
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold">
                        ★
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 text-sm mb-1">{r.description}</p>
                        <p className="text-xs text-emerald-700 font-medium">
                          {t('profile.records.issued')} {new Date(r.created_at).toLocaleDateString(dateLocale)} •{' '}
                          {t('profile.records.author')} {r.author_name}
                        </p>
                      </div>
                    </div>
                  ))}
                  {rewards.length === 0 && (
                    <p className="text-center text-gray-400 py-12 border-2 border-dashed border-gray-100 rounded-2xl">
                      {t('profile.records.empty_rewards')}
                    </p>
                  )}
                </div>
              )}

              {/* ВКЛАДКА 4: ВЫГОВОРЫ */}
              {activeTab === 'reprimands' && (
                <div className="space-y-3 overflow-y-auto max-h-[540px]">
                  {reprimands.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 border border-red-200 bg-red-50/40 rounded-2xl flex items-start gap-3.5"
                    >
                      <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 font-bold">
                        !
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 text-sm mb-1">{r.description}</p>
                        <p className="text-xs text-red-600 font-medium">
                          {t('profile.records.issued')} {new Date(r.created_at).toLocaleDateString(dateLocale)} •{' '}
                          {t('profile.records.author')} {r.author_name}
                        </p>
                      </div>
                    </div>
                  ))}
                  {reprimands.length === 0 && (
                    <p className="text-center text-emerald-600 font-semibold py-12 border-2 border-dashed border-emerald-100 rounded-2xl bg-emerald-50/20">
                      {t('profile.records.empty_reprimands')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* МОДАЛЬНОЕ ОКНО: ДОБАВЛЕНИЕ ПАРЫ В РАСПИСАНИЕ */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-lg">{t('profile.schedule.modal_title')}</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-gray-800 text-2xl leading-none">
                &times;
              </button>
            </div>

            <form onSubmit={handleAddScheduleItem} className="p-6 space-y-4">
              {scheduleError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold leading-relaxed">
                  {scheduleError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t('profile.schedule.week_type_label')}</label>
                  <select
                    value={scheduleForm.week_type}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, week_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="both">{t('profile.schedule.both_weeks')}</option>
                    <option value="odd">{t('profile.schedule.odd_week')}</option>
                    <option value="even">{t('profile.schedule.even_week')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t('profile.schedule.day_label')}</label>
                  <select
                    value={scheduleForm.day_of_week}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, day_of_week: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    {daysOfWeek.map((d) => (
                      <option key={d} value={d}>
                        {t(`profile.schedule.days.${d}`, { defaultValue: d })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t('profile.schedule.time_label')}</label>
                  <select
                    value={scheduleForm.time_slot}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, time_slot: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    {timeSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t('profile.schedule.class_type_label')}</label>
                  <select
                    value={scheduleForm.class_type}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, class_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value={t('profile.schedule.types.lecture')}>{t('profile.schedule.types.lecture')}</option>
                    <option value={t('profile.schedule.types.practice')}>{t('profile.schedule.types.practice')}</option>
                    <option value={t('profile.schedule.types.lab')}>{t('profile.schedule.types.lab')}</option>
                    <option value={t('profile.schedule.types.seminar')}>{t('profile.schedule.types.seminar')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('profile.schedule.subject_label')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('profile.schedule.subject_placeholder')}
                  value={scheduleForm.subject_name}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, subject_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t('profile.schedule.room_label')}</label>
                  <input
                    type="text"
                    required
                    placeholder={t('profile.schedule.room_placeholder')}
                    value={scheduleForm.room}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, room: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t('profile.schedule.group_label')}</label>
                  <input
                    type="text"
                    required
                    placeholder={t('profile.schedule.group_placeholder')}
                    value={scheduleForm.group}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, group: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 font-bold text-sm hover:bg-gray-100"
                >
                  {t('tasks.modal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingSchedule}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-bold text-sm transition shadow-md"
                >
                  {submittingSchedule ? t('profile.modal.save') : t('profile.schedule.save_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: ДОСТИЖЕНИЕ ИЛИ ВЫГОВОР */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-lg">{t('profile.modal.title')}</h3>
              <button onClick={() => setShowRecordModal(false)} className="text-gray-400 hover:text-gray-800 text-2xl leading-none">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t('profile.modal.type')}</label>
                <select
                  value={recordData.record_type}
                  onChange={(e) => setRecordData({ ...recordData, record_type: e.target.value })}
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
                  onChange={(e) => setRecordData({ ...recordData, description: e.target.value })}
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