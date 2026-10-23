import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';

export default function Tasks() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('my_tasks');
  const [viewMode, setViewMode] = useState('board'); // 'board' | 'list'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState('');
  const [recommendedInfo, setRecommendedInfo] = useState(null);

  // Фильтры
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCreator, setFilterCreator] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [hideSubtasks, setHideSubtasks] = useState(false);

  // Состояния для боковой панели быстрого предпросмотра (Drawer)
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [drawerActionMode, setDrawerActionMode] = useState('none'); // 'none' | 'quality' | 'revision'
  const [qualityScore, setQualityScore] = useState(5);
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionFile, setRevisionFile] = useState(null);
  const [reportComment, setReportComment] = useState('');
  const [reportFile, setReportFile] = useState(null);
  const [submittingReport, setSubmittingReport] = useState(false);

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    deadline: '',
    assignee_ids: [],
    target_department_ids: []
  });

  const dateLocale = i18n.language === 'en' ? 'en-US' : i18n.language === 'tk' ? 'tk-TM' : 'ru-RU';

  const fetchData = async () => {
    try {
      const [meRes, tasksRes, usersRes, deptsRes, analyticsRes] = await Promise.all([
        api.get('/users/me/'),
        api.get('/tasks/'),
        api.get('/users/'),
        api.get('/departments/'),
        api.get('/analytics/dashboard/').catch(() => ({ data: null }))
      ]);

      const user = meRes.data;
      setCurrentUser((prev) => prev || user);
      setTasks(tasksRes.data);
      setUsers(usersRes.data);
      setDepartments(deptsRes.data);
      if (analyticsRes.data) setAnalytics(analyticsRes.data);

      if (!currentUser && user.is_rectorate) {
        setActiveTab('all');
      }
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Закрытие боковой панели по клавише Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedTaskId && !showCreateModal) {
        setSelectedTaskId(null);
        setDrawerActionMode('none');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId, showCreateModal]);

  const openTaskDrawer = (taskId) => {
    setSelectedTaskId(taskId);
    setDrawerActionMode('none');
    setQualityScore(5);
    setRevisionReason('');
    setRevisionFile(null);
    setReportComment('');
    setReportFile(null);
  };

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;

    const task = tasks.find((item) => item.id === parseInt(taskId));
    if (!task || task.status === newStatus) return;

    if (newStatus === 'completed' && task.subtasks?.some((s) => s.status !== 'completed')) {
      alert(t('task_detail.subtasks.incomplete_warning'));
      return;
    }

    const originalTasks = [...tasks];
    setTasks(tasks.map((item) => (item.id === parseInt(taskId) ? { ...item, status: newStatus } : item)));

    try {
      await api.patch(`/tasks/${taskId}/`, { status: newStatus });
      fetchData();
    } catch (error) {
      setTasks(originalTasks);
      let errMsg = t('tasks.errors.status_change');
      if (error.response?.data?.status) {
        errMsg = error.response.data.status[0];
      }
      alert(errMsg);
    }
  };

  // Смена статуса задачи из боковой панели
  const handleDrawerStatusChange = async (taskObj, newStatus, score = null) => {
    if (!taskObj || isChangingStatus) return;
    setIsChangingStatus(true);
    try {
      const payload = { status: newStatus };
      if (score !== null) {
        payload.quality_score = score;
      }
      await api.patch(`/tasks/${taskObj.id}/`, payload);
      setDrawerActionMode('none');
      await fetchData();
    } catch (error) {
      const serverMsg = error.response?.data?.status?.[0] || t('tasks.errors.status_change');
      alert(serverMsg);
    } finally {
      setIsChangingStatus(false);
    }
  };

  // Возврат на доработку с обязательным комментарием из боковой панели
  const handleDrawerRevisionSubmit = async (e, taskObj) => {
    e.preventDefault();
    if (!taskObj || !revisionReason.trim() || isChangingStatus) return;

    setIsChangingStatus(true);
    try {
      const formData = new FormData();
      formData.append('task', taskObj.id);
      formData.append('comment', `[REVISION] ${revisionReason.trim()}`);
      if (revisionFile) {
        formData.append('attached_file', revisionFile);
      }

      await api.post('/reports/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await api.patch(`/tasks/${taskObj.id}/`, { status: 'revision' });

      setDrawerActionMode('none');
      setRevisionReason('');
      setRevisionFile(null);
      await fetchData();
    } catch (error) {
      const serverMsg = error.response?.data?.status?.[0] || t('tasks.errors.status_change');
      alert(serverMsg);
    } finally {
      setIsChangingStatus(false);
    }
  };

  // Отправка отчета или комментария из боковой панели
  const handleDrawerReportSubmit = async (e, taskObj) => {
    e.preventDefault();
    if (!taskObj || !reportComment.trim() || submittingReport) return;

    setSubmittingReport(true);
    try {
      const formData = new FormData();
      formData.append('task', taskObj.id);
      formData.append('comment', reportComment.trim());
      if (reportFile) {
        formData.append('attached_file', reportFile);
      }

      await api.post('/reports/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setReportComment('');
      setReportFile(null);
      await fetchData();
    } catch (error) {
      alert('Ошибка при отправке отчета');
      console.error(error);
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleDownloadFile = async (e, fileUrl) => {
    e.preventDefault();
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const fileName = fileUrl.split('/').pop() || 'report';
      link.download = decodeURIComponent(fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      window.open(fileUrl, '_blank');
    }
  };

  const getBaseTabTasks = () => {
    if (!currentUser) return [];
    let filtered = [...tasks];

    if (activeTab === 'my_tasks') {
      filtered = filtered.filter(
        (item) =>
          item.assignees?.some((a) => a.id === currentUser.id) ||
          (currentUser.department && item.target_departments?.some((d) => d.id === currentUser.department))
      );
    } else if (activeTab === 'delegated') {
      filtered = filtered.filter((item) => item.creator?.id === currentUser.id);
    } else if (activeTab === 'dept_all' && currentUser.department) {
      filtered = filtered.filter(
        (item) =>
          item.target_departments?.some((d) => d.id === currentUser.department) ||
          item.assignees?.some((a) => a.department === currentUser.department)
      );
    }

    if (filterCreator) filtered = filtered.filter((item) => item.creator?.id === parseInt(filterCreator));
    if (filterAssignee) filtered = filtered.filter((item) => item.assignees?.some((a) => a.id === parseInt(filterAssignee)));
    if (filterDept) filtered = filtered.filter((item) => item.target_departments?.some((d) => d.id === parseInt(filterDept)));

    if (hideSubtasks) {
      filtered = filtered.filter((item) => !item.parent_task);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.creator?.last_name?.toLowerCase().includes(q)
      );
    }

    return filtered;
  };

  const getEmployeeMetrics = (userObj) => {
    const stats = analytics?.employees?.find((emp) => emp.id === userObj.id);
    const activeTasksCount = stats
      ? stats.statuses.created + stats.statuses.in_progress + stats.statuses.revision + stats.statuses.on_review
      : tasks.filter((task) => task.status !== 'completed' && task.assignees?.some((a) => a.id === userObj.id)).length;

    let scheduleCount = 0;
    if (userObj.schedule) {
      const oddClasses = Object.values(userObj.schedule.odd || {}).reduce((acc, arr) => acc + arr.length, 0);
      const evenClasses = Object.values(userObj.schedule.even || {}).reduce((acc, arr) => acc + arr.length, 0);
      scheduleCount = Math.round((oddClasses + evenClasses) / 2);
    }

    const quality = stats?.quality || 0;
    return { activeTasksCount, scheduleCount, quality };
  };

  const getSubordinateUsers = () => {
    if (!currentUser) return [];
    const list = users.filter((u) => {
      if (u.id === currentUser.id) return false;
      if (currentUser.is_rectorate) return true;
      if (u.is_rectorate) return false;
      if (['dean', 'deputy_dean'].includes(currentUser.position)) {
        return u.position !== 'dean';
      }
      if (currentUser.position === 'head_of_department') {
        return (
          u.department === currentUser.department &&
          !['dean', 'deputy_dean', 'head_of_department'].includes(u.position)
        );
      }
      return false;
    });

    return list.sort((a, b) => {
      const aWorking = a.work_status === 'working' ? 0 : 1;
      const bWorking = b.work_status === 'working' ? 0 : 1;
      if (aWorking !== bWorking) return aWorking - bWorking;

      const mA = getEmployeeMetrics(a);
      const mB = getEmployeeMetrics(b);
      if (mA.activeTasksCount !== mB.activeTasksCount) {
        return mA.activeTasksCount - mB.activeTasksCount;
      }
      if (mA.scheduleCount !== mB.scheduleCount) {
        return mA.scheduleCount - mB.scheduleCount;
      }
      return mB.quality - mA.quality;
    });
  };

  const handleSmartPickAssignee = () => {
    setCreateError('');
    const subordinates = getSubordinateUsers();
    let candidates = subordinates.filter((u) => u.work_status === 'working');

    if (newTask.target_department_ids.length > 0) {
      const deptIds = newTask.target_department_ids.map(Number);
      const deptCandidates = candidates.filter((u) => deptIds.includes(u.department));
      if (deptCandidates.length > 0) {
        candidates = deptCandidates;
      }
    }

    if (candidates.length === 0) {
      setRecommendedInfo(null);
      setCreateError(t('tasks.modal.smart_pick_none'));
      return;
    }

    const bestUser = candidates[0];
    const metrics = getEmployeeMetrics(bestUser);

    setNewTask((prev) => ({
      ...prev,
      assignee_ids: [String(bestUser.id)]
    }));

    setRecommendedInfo({
      id: bestUser.id,
      name: `${bestUser.last_name} ${bestUser.first_name}`,
      activeTasks: metrics.activeTasksCount,
      scheduleCount: metrics.scheduleCount,
      quality: metrics.quality
    });
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setCreateError('');
    if (newTask.assignee_ids.length === 0 && newTask.target_department_ids.length === 0) {
      setCreateError(t('tasks.modal.error_assignee'));
      return;
    }
    try {
      await api.post('/tasks/', { ...newTask, creator_id: currentUser.id });
      setShowCreateModal(false);
      setRecommendedInfo(null);
      setNewTask({ title: '', description: '', deadline: '', assignee_ids: [], target_department_ids: [] });
      fetchData();
    } catch (error) {
      const backendErr = error.response?.data?.assignee_ids?.[0] || t('tasks.modal.error_create');
      setCreateError(backendErr);
    }
  };

  const getDeadlineMeta = (task) => {
    const deadlineDate = new Date(task.deadline);
    const now = new Date();
    const isCompleted = task.status === 'completed';
    const diffMs = deadlineDate - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const formattedDate = deadlineDate.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });

    if (isCompleted) {
      return {
        isOverdue: false,
        badgeText: formattedDate,
        badgeClass: 'bg-green-50 text-green-700 border-green-200'
      };
    }

    if (diffMs < 0) {
      return {
        isOverdue: true,
        badgeText: `${t('tasks.card.overdue_short')} • ${formattedDate}`,
        badgeClass: 'bg-red-100 text-red-700 border-red-200 animate-pulse'
      };
    }

    if (diffDays <= 1) {
      return {
        isOverdue: false,
        badgeText: `${t('tasks.card.today')} • ${formattedDate}`,
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200'
      };
    }

    if (diffDays <= 3) {
      return {
        isOverdue: false,
        badgeText: `${diffDays} ${t('tasks.card.days_left')} • ${formattedDate}`,
        badgeClass: 'bg-yellow-50 text-yellow-700 border-yellow-200'
      };
    }

    return {
      isOverdue: false,
      badgeText: `${formattedDate} (${diffDays} ${t('tasks.card.days_left')})`,
      badgeClass: 'bg-gray-50 text-gray-600 border-gray-200'
    };
  };

  const getTotalHoursSpent = (task) => {
    if (!task.status_logs || task.status_logs.length === 0) return 0;
    const total = task.status_logs.reduce((sum, log) => sum + (log.hours_spent || 0), 0);
    return parseFloat(total.toFixed(1));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">{t('tasks.loading')}</div>;

  const baseTasks = getBaseTabTasks();
  const overdueCount = baseTasks.filter((item) => new Date(item.deadline) < new Date() && item.status !== 'completed').length;
  const inProgressCount = baseTasks.filter((item) => item.status === 'in_progress' || item.status === 'revision').length;
  const onReviewCount = baseTasks.filter((item) => item.status === 'on_review').length;

  const filteredTasks = onlyOverdue
    ? baseTasks.filter((item) => new Date(item.deadline) < new Date() && item.status !== 'completed')
    : baseTasks;

  const isAdmin = currentUser.is_rectorate || currentUser.is_manager;
  const canAssignDepartments = currentUser.is_rectorate || ['dean', 'deputy_dean'].includes(currentUser.position);
  const subordinateUsers = getSubordinateUsers();

  // Выбранная задача для боковой панели
  const selectedTask = selectedTaskId ? tasks.find((item) => item.id === Number(selectedTaskId)) : null;

  const columns = [
    { id: 'created', title: t('tasks.columns.created'), bg: 'bg-gray-100/80', border: 'border-gray-200', text: 'text-gray-700', dot: 'bg-gray-400' },
    { id: 'in_progress', title: t('tasks.columns.in_progress'), bg: 'bg-blue-50/70', border: 'border-blue-200', text: 'text-blue-800', dot: 'bg-blue-500' },
    { id: 'on_review', title: t('tasks.columns.on_review'), bg: 'bg-amber-50/70', border: 'border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500' },
    { id: 'revision', title: t('tasks.columns.revision'), bg: 'bg-red-50/70', border: 'border-red-200', text: 'text-red-800', dot: 'bg-red-500' },
    { id: 'completed', title: t('tasks.columns.completed'), bg: 'bg-emerald-50/70', border: 'border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' }
  ];

  return (
    <div className="max-w-[1550px] mx-auto pb-6 space-y-4">
      {/* ВЕРХНЯЯ ПАНЕЛЬ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{t('tasks.title')}</h1>
            <div className="flex flex-wrap gap-4 mt-4 border-b border-gray-200 pb-1">
              {!currentUser.is_rectorate && (
                <button
                  onClick={() => setActiveTab('my_tasks')}
                  className={`pb-2 font-bold text-sm transition-colors ${
                    activeTab === 'my_tasks' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {t('tasks.tabs.my_tasks')}
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => setActiveTab('delegated')}
                  className={`pb-2 font-bold text-sm transition-colors ${
                    activeTab === 'delegated' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {t('tasks.tabs.delegated')}
                </button>
              )}
              {currentUser.is_manager && (
                <button
                  onClick={() => setActiveTab('dept_all')}
                  className={`pb-2 font-bold text-sm transition-colors ${
                    activeTab === 'dept_all' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {t('tasks.tabs.dept_all')}
                </button>
              )}
              {(currentUser.is_rectorate || ['dean', 'deputy_dean'].includes(currentUser.position)) && (
                <button
                  onClick={() => setActiveTab('all')}
                  className={`pb-2 font-bold text-sm transition-colors ${
                    activeTab === 'all' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {t('tasks.tabs.all')}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 self-end lg:self-center">
            <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'board' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                <span>{t('tasks.views.board')}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span>{t('tasks.views.list')}</span>
              </button>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setCreateError('');
                  setRecommendedInfo(null);
                  setShowCreateModal(true);
                }}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-sm whitespace-nowrap"
              >
                {t('tasks.create_btn')}
              </button>
            )}
          </div>
        </div>

        {/* БЫСТРЫЕ МЕТРИКИ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">{t('tasks.stats.total')}</span>
            <span className="text-xl font-black text-gray-800">{baseTasks.length}</span>
          </div>
          <div className="bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700">{t('tasks.stats.in_progress')}</span>
            <span className="text-xl font-black text-blue-700">{inProgressCount}</span>
          </div>
          <div className="bg-amber-50/60 border border-amber-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700">{t('tasks.stats.on_review')}</span>
            <span className="text-xl font-black text-amber-700">{onReviewCount}</span>
          </div>
          <button
            type="button"
            onClick={() => setOnlyOverdue(!onlyOverdue)}
            className={`rounded-xl px-4 py-3 flex items-center justify-between border transition text-left ${
              onlyOverdue
                ? 'bg-red-600 text-white border-red-600 shadow-sm'
                : 'bg-red-50/60 border-red-100 text-red-700 hover:bg-red-100/70'
            }`}
          >
            <span className="text-xs font-bold">{t('tasks.stats.overdue')}</span>
            <span className="text-xl font-black">{overdueCount}</span>
          </button>
        </div>

        {/* ПОИСК И ФИЛЬТРЫ */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-gray-100">
          <div className="relative flex-1 min-w-[220px]">
            <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('tasks.filters.search_placeholder')}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filterCreator}
            onChange={(e) => setFilterCreator(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-gray-50 text-gray-700 focus:outline-none"
          >
            <option value="">{t('tasks.filters.creator_all')}</option>
            {users
              .filter((u) => u.is_rectorate || u.is_manager)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.last_name} {u.first_name}
                </option>
              ))}
          </select>

          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-gray-50 text-gray-700 focus:outline-none"
          >
            <option value="">{t('tasks.filters.assignee_all')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.last_name} {u.first_name}
              </option>
            ))}
          </select>

          {canAssignDepartments && (
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-gray-50 text-gray-700 focus:outline-none"
            >
              <option value="">{t('tasks.filters.dept_all')}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl cursor-pointer select-none hover:bg-gray-100">
            <input
              type="checkbox"
              checked={hideSubtasks}
              onChange={(e) => setHideSubtasks(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>{t('tasks.filters.hide_subtasks')}</span>
          </label>
        </div>
      </div>

      {/* РЕЖИМ 1: ДЕТАЛЬНАЯ КАНБАН-ДОСКА */}
      {viewMode === 'board' ? (
        <div className="flex overflow-x-auto gap-4 h-[calc(100vh-310px)] min-h-[500px] items-start pb-2">
          {columns.map((col) => {
            let tasksInCol = filteredTasks.filter((item) => item.status === col.id);
            tasksInCol.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            const totalTasks = tasksInCol.length;
            if (col.id === 'completed' && totalTasks > 20) {
              tasksInCol = tasksInCol.slice(0, 20);
            }

            return (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`${col.bg} border ${col.border} rounded-2xl p-3 flex-1 min-w-[295px] max-w-[340px] flex flex-col h-full max-h-full transition-colors`}
              >
                <div className="flex justify-between items-center mb-3 px-1.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`}></span>
                    <h3 className={`font-bold text-sm ${col.text}`}>{col.title}</h3>
                  </div>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-white text-gray-700 shadow-sm">
                    {totalTasks}
                  </span>
                </div>

                <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                  {tasksInCol.map((task) => {
                    const deadlineMeta = getDeadlineMeta(task);
                    const subtasksTotal = task.subtasks?.length || 0;
                    const subtasksDone = task.subtasks?.filter((s) => s.status === 'completed').length || 0;
                    const subtasksPercent = subtasksTotal > 0 ? Math.round((subtasksDone / subtasksTotal) * 100) : 0;
                    const reportsCount = task.reports?.length || 0;
                    const hoursSpent = getTotalHoursSpent(task);
                    const isSelected = selectedTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={() => openTaskDrawer(task.id)}
                        className={`bg-white p-4 rounded-xl shadow-sm hover:shadow-md border transition-all flex flex-col gap-2.5 shrink-0 cursor-pointer group ${
                          isSelected
                            ? 'border-blue-500 ring-2 ring-blue-200'
                            : deadlineMeta.isOverdue
                            ? 'border-red-300 ring-1 ring-red-100'
                            : 'border-gray-100 hover:border-blue-200'
                        }`}
                      >
                        <div className="flex justify-between items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${deadlineMeta.badgeClass}`}>
                            {deadlineMeta.badgeText}
                          </span>

                          <div className="flex items-center gap-1">
                            {task.parent_task && (
                              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded">
                                {t('tasks.card.subtask_badge')}
                              </span>
                            )}
                            {task.quality_score && (
                              <span className="text-[10px] font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded">
                                ★ {task.quality_score}/5
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-bold text-gray-800 text-sm leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}
                        </div>

                        {task.target_departments?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {task.target_departments.map((dept) => (
                              <span
                                key={dept.id}
                                className="text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-md truncate max-w-full"
                              >
                                {dept.name}
                              </span>
                            ))}
                          </div>
                        )}

                        {subtasksTotal > 0 && (
                          <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                            <div className="flex justify-between items-center text-[10px] font-bold text-gray-600 mb-1">
                              <span>{t('tasks.card.subtasks_progress')}</span>
                              <span>
                                {subtasksDone}/{subtasksTotal} ({subtasksPercent}%)
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 transition-all"
                                style={{ width: `${subtasksPercent}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 mt-auto">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="flex -space-x-1.5 shrink-0">
                              {task.assignees?.slice(0, 3).map((a, i) => (
                                <div
                                  key={i}
                                  className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                                  title={`${a.last_name} ${a.first_name}`}
                                >
                                  {a.last_name ? a.last_name.charAt(0) : 'U'}
                                </div>
                              ))}
                            </div>
                            {task.assignees?.length === 1 ? (
                              <span className="text-[11px] font-semibold text-gray-700 truncate">
                                {task.assignees[0].last_name} {task.assignees[0].first_name?.[0]}.
                              </span>
                            ) : task.assignees?.length > 1 ? (
                              <span className="text-[10px] font-bold text-gray-500">
                                ({task.assignees.length})
                              </span>
                            ) : (
                              <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-1.5 py-0.5 rounded border border-blue-100">
                                {t('tasks.card.department')}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0 text-[10px] text-gray-500 font-semibold">
                            {reportsCount > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-gray-600" title={t('tasks.card.reports_count')}>
                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                                {reportsCount}
                              </span>
                            )}

                            {hoursSpent > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-gray-500">
                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {hoursSpent}{t('tasks.card.hours_spent')}
                              </span>
                            )}

                            {task.revision_count > 0 && (
                              <span className="text-[10px] text-red-600 font-bold bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                                ↻ {task.revision_count}
                              </span>
                            )}

                            <span
                              className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded truncate max-w-[75px]"
                              title={`${t('tasks.card.creator')}: ${task.creator?.last_name} ${task.creator?.first_name}`}
                            >
                              {task.creator?.last_name}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {totalTasks > 20 && col.id === 'completed' && (
                    <div className="text-center text-xs text-gray-400 mt-2 py-2 border-t border-dashed border-gray-200 shrink-0">
                      {t('tasks.board.showing_last')} 20 {t('tasks.board.out_of')} {totalTasks}
                    </div>
                  )}
                  {totalTasks === 0 && (
                    <div className="text-center text-gray-400 text-xs mt-4 py-6 shrink-0 border-2 border-dashed border-gray-200 rounded-xl bg-white/50">
                      {t('tasks.board.drop_here')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* РЕЖИМ 2: ДЕТАЛЬНЫЙ ТАБЛИЧНЫЙ СПИСОК */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filteredTasks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-3.5 px-5">{t('tasks.table.task')}</th>
                    <th className="py-3.5 px-4">{t('tasks.table.status')}</th>
                    <th className="py-3.5 px-4">{t('tasks.table.creator')}</th>
                    <th className="py-3.5 px-4">{t('tasks.table.assignees')}</th>
                    <th className="py-3.5 px-4">{t('tasks.table.progress')}</th>
                    <th className="py-3.5 px-5 text-right">{t('tasks.table.deadline')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredTasks.map((task) => {
                    const deadlineMeta = getDeadlineMeta(task);
                    const subtasksTotal = task.subtasks?.length || 0;
                    const subtasksDone = task.subtasks?.filter((s) => s.status === 'completed').length || 0;
                    const hoursSpent = getTotalHoursSpent(task);
                    const reportsCount = task.reports?.length || 0;

                    return (
                      <tr
                        key={task.id}
                        onClick={() => openTaskDrawer(task.id)}
                        className={`hover:bg-blue-50/40 transition-colors cursor-pointer group ${
                          selectedTaskId === task.id ? 'bg-blue-50/60' : ''
                        }`}
                      >
                        <td className="py-4 px-5 max-w-md">
                          <div className="flex items-center gap-2 mb-1">
                            {task.parent_task && (
                              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded">
                                {t('tasks.card.subtask_badge')}
                              </span>
                            )}
                            <span className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                              {task.title}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-1">{task.description}</p>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                              task.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : task.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-700'
                                : task.status === 'revision'
                                ? 'bg-red-100 text-red-700'
                                : task.status === 'on_review'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {t(`tasks.status.${task.status}`)}
                          </span>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap text-xs font-semibold text-gray-700">
                          {task.creator?.last_name} {task.creator?.first_name}
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {task.assignees?.map((a) => (
                              <span
                                key={a.id}
                                className="text-xs font-medium bg-gray-100 text-gray-800 px-2.5 py-0.5 rounded-lg"
                              >
                                {a.last_name} {a.first_name?.[0]}.
                              </span>
                            ))}
                            {task.target_departments?.map((d) => (
                              <span
                                key={d.id}
                                className="text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-0.5 rounded-lg"
                              >
                                {d.name}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-3 text-xs text-gray-600 font-semibold">
                            {subtasksTotal > 0 && (
                              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold">
                                {subtasksDone}/{subtasksTotal}
                              </span>
                            )}
                            {reportsCount > 0 && (
                              <span>
                                {t('tasks.card.reports_count')}: {reportsCount}
                              </span>
                            )}
                            {hoursSpent > 0 && (
                              <span className="text-gray-400">
                                {hoursSpent} {t('tasks.card.hours_spent')}
                              </span>
                            )}
                            {task.quality_score && (
                              <span className="text-yellow-600 font-bold">★ {task.quality_score}/5</span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${deadlineMeta.badgeClass}`}>
                            {deadlineMeta.badgeText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400">{t('tasks.not_found')}</div>
          )}
        </div>
      )}

      {/* ВЫЕЗЖАЮЩАЯ БОКОВАЯ ПАНЕЛЬ ПРЕДПРОСМОТРА ЗАДАЧИ (SLIDE-OVER DRAWER) */}
      {selectedTask && (() => {
        const isDirectAssignee = selectedTask.assignees?.some((a) => a.id === currentUser.id);
        const isInTargetDept = Boolean(
          currentUser.department && selectedTask.target_departments?.some((d) => d.id === currentUser.department)
        );
        const isTaskAssignee = isDirectAssignee || isInTargetDept;
        const isTaskCreator = selectedTask.creator?.id === currentUser.id;
        const canReviewTask = isTaskCreator || currentUser.is_rectorate;
        const isTaskOverdue = new Date(selectedTask.deadline) < new Date() && selectedTask.status !== 'completed';
        const subtasksList = selectedTask.subtasks || [];
        const completedSubtasks = subtasksList.filter((s) => s.status === 'completed').length;
        const subtaskProgress = subtasksList.length > 0 ? Math.round((completedSubtasks / subtasksList.length) * 100) : 0;
        const totalHours = getTotalHoursSpent(selectedTask);
        const taskReports = selectedTask.reports || [];

        return (
          <div
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-[1px] z-50 flex justify-end"
            onClick={() => setSelectedTaskId(null)}
          >
            <div
              className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-gray-200 flex flex-col overflow-hidden animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Шапка боковой панели */}
              <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs uppercase font-bold px-3 py-1 rounded-full ${
                      selectedTask.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : selectedTask.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-700'
                        : selectedTask.status === 'revision'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {t(`tasks.status.${selectedTask.status}`)}
                  </span>

                  {isTaskOverdue && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                      {t('task_detail.overdue')}
                    </span>
                  )}

                  {selectedTask.quality_score && (
                    <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      ★ {selectedTask.quality_score} / 5
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/tasks/${selectedTask.id}`)}
                    className="inline-flex items-center gap-1.5 bg-white hover:bg-blue-50 text-blue-600 border border-gray-200 hover:border-blue-200 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    <span>{t('tasks.drawer.open_full')}</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTaskId(null)}
                    className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition text-2xl leading-none"
                    title={t('tasks.drawer.close')}
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Прокручиваемое содержимое боковой панели */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {/* Заголовок и описание */}
                <div>
                  {selectedTask.parent_task && (
                    <button
                      type="button"
                      onClick={() => openTaskDrawer(selectedTask.parent_task)}
                      className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition"
                    >
                      &larr; {t('task_detail.parent_task_link')} #{selectedTask.parent_task}
                    </button>
                  )}
                  <h2 className="text-xl font-bold text-gray-900 leading-snug">{selectedTask.title}</h2>
                  <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {selectedTask.description}
                  </p>
                </div>

                {/* БЫСТРАЯ СМЕНА СТАТУСА */}
                {selectedTask.status !== 'completed' && (isTaskAssignee || canReviewTask) && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                      {t('tasks.drawer.quick_actions')}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {selectedTask.status === 'created' && isTaskAssignee && (
                        <button
                          type="button"
                          disabled={isChangingStatus}
                          onClick={() => handleDrawerStatusChange(selectedTask, 'in_progress')}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                        >
                          {t('task_detail.actions.take_in_progress')}
                        </button>
                      )}

                      {(selectedTask.status === 'in_progress' || selectedTask.status === 'revision') && isTaskAssignee && (
                        <button
                          type="button"
                          disabled={isChangingStatus}
                          onClick={() => handleDrawerStatusChange(selectedTask, 'on_review')}
                          className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                        >
                          {t('task_detail.actions.send_to_review')}
                        </button>
                      )}

                      {selectedTask.status === 'on_review' && canReviewTask && (
                        <>
                          <button
                            type="button"
                            disabled={isChangingStatus}
                            onClick={() => {
                              if (subtasksList.some((s) => s.status !== 'completed')) {
                                alert(t('task_detail.subtasks.incomplete_warning'));
                                return;
                              }
                              setDrawerActionMode(drawerActionMode === 'quality' ? 'none' : 'quality');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                          >
                            {t('task_detail.actions.accept')}
                          </button>

                          <button
                            type="button"
                            disabled={isChangingStatus}
                            onClick={() => setDrawerActionMode(drawerActionMode === 'revision' ? 'none' : 'revision')}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                          >
                            {t('task_detail.actions.return_revision')}
                          </button>
                        </>
                      )}
                    </div>

                    {/* Встроенный блок оценки качества 1-5 звезд */}
                    {drawerActionMode === 'quality' && (
                      <div className="bg-white p-4 rounded-xl border border-emerald-200 space-y-3 mt-2">
                        <p className="text-xs font-bold text-gray-700">{t('task_detail.quality_modal.subtitle')}</p>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setQualityScore(star)}
                              className={`w-9 h-9 rounded-lg font-black text-base transition border ${
                                qualityScore >= star
                                  ? 'bg-yellow-400 text-white border-yellow-500 shadow-sm'
                                  : 'bg-gray-50 text-gray-400 border-gray-200'
                              }`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setDrawerActionMode('none')}
                            className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg"
                          >
                            {t('tasks.modal.cancel')}
                          </button>
                          <button
                            type="button"
                            disabled={isChangingStatus}
                            onClick={() => handleDrawerStatusChange(selectedTask, 'completed', qualityScore)}
                            className="px-4 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                          >
                            {t('task_detail.quality_modal.confirm')} ({qualityScore}/5)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Встроенный блок возврата на доработку с обязательной причиной */}
                    {drawerActionMode === 'revision' && (
                      <form onSubmit={(e) => handleDrawerRevisionSubmit(e, selectedTask)} className="bg-white p-4 rounded-xl border border-red-200 space-y-3 mt-2">
                        <p className="text-xs font-bold text-red-700">{t('task_detail.revision_modal.subtitle')}</p>
                        <textarea
                          rows="3"
                          required
                          value={revisionReason}
                          onChange={(e) => setRevisionReason(e.target.value)}
                          placeholder={t('task_detail.revision_modal.placeholder')}
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
                        ></textarea>
                        <input
                          type="file"
                          onChange={(e) => setRevisionFile(e.target.files[0])}
                          className="text-xs text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-red-50 file:text-red-700 cursor-pointer"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setDrawerActionMode('none')}
                            className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg"
                          >
                            {t('tasks.modal.cancel')}
                          </button>
                          <button
                            type="submit"
                            disabled={isChangingStatus || !revisionReason.trim()}
                            className="px-4 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300"
                          >
                            {t('task_detail.revision_modal.confirm')}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* СЕТКА МЕТАДАННЫХ ЗАДАЧИ */}
                <div className="grid grid-cols-2 gap-3 bg-white border border-gray-100 rounded-2xl p-4 text-xs">
                  <div>
                    <p className="text-gray-400 font-medium mb-0.5">{t('task_detail.info.deadline')}</p>
                    <p className={`font-bold ${isTaskOverdue ? 'text-red-600' : 'text-gray-800'}`}>
                      {new Date(selectedTask.deadline).toLocaleString(dateLocale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-medium mb-0.5">{t('task_detail.info.creator')}</p>
                    <p className="font-bold text-gray-800">
                      {selectedTask.creator?.last_name} {selectedTask.creator?.first_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-medium mb-0.5">{t('tasks.drawer.time_spent')}</p>
                    <p className="font-bold text-gray-800">
                      {totalHours} {t('tasks.card.hours_spent')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-medium mb-0.5">{t('task_detail.info.revision_count')}</p>
                    <p className="font-bold text-gray-800">{selectedTask.revision_count}</p>
                  </div>

                  <div className="col-span-2 pt-2 border-t border-gray-100">
                    <p className="text-gray-400 font-medium mb-1.5">{t('task_detail.info.assignees_title')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTask.assignees?.map((u) => (
                        <Link
                          key={u.id}
                          to={`/profile/${u.id}`}
                          className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-blue-50 text-gray-800 hover:text-blue-700 px-2.5 py-1 rounded-lg font-semibold transition"
                        >
                          <span>
                            {u.last_name} {u.first_name}
                          </span>
                        </Link>
                      ))}
                      {selectedTask.target_departments?.map((d) => (
                        <span
                          key={d.id}
                          className="bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-lg font-semibold"
                        >
                          {d.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* СПИСОК ПОДЗАДАЧ (ЕСЛИ ЕСТЬ) */}
                {subtasksList.length > 0 && (
                  <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                      <span>
                        {t('task_detail.subtasks.title')} ({completedSubtasks}/{subtasksList.length})
                      </span>
                      <span>{subtaskProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${subtaskProgress}%` }}></div>
                    </div>
                    <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                      {subtasksList.map((sub) => (
                        <div
                          key={sub.id}
                          onClick={() => openTaskDrawer(sub.id)}
                          className="p-2.5 bg-white hover:bg-gray-50 cursor-pointer flex items-center justify-between gap-2 text-xs"
                        >
                          <span className={`font-bold truncate ${sub.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {sub.title}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 shrink-0">
                            {t(`tasks.status.${sub.status}`)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ОТЧЕТЫ И КОММЕНТАРИИ */}
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-sm">
                      {t('task_detail.reports.title')} ({taskReports.length})
                    </h3>
                  </div>

                  {(isTaskAssignee || canReviewTask) && selectedTask.status !== 'completed' && (
                    <form onSubmit={(e) => handleDrawerReportSubmit(e, selectedTask)} className="p-4 border-b border-gray-100 space-y-3 bg-white">
                      <textarea
                        rows="2"
                        required
                        value={reportComment}
                        onChange={(e) => setReportComment(e.target.value)}
                        placeholder={t('task_detail.reports.placeholder')}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-blue-500 resize-none"
                      ></textarea>
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="file"
                          onChange={(e) => setReportFile(e.target.files[0])}
                          className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 cursor-pointer"
                        />
                        <button
                          type="submit"
                          disabled={submittingReport}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-1.5 rounded-xl font-bold text-xs transition shrink-0"
                        >
                          {submittingReport ? t('task_detail.reports.submitting') : t('task_detail.reports.submit_btn')}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
                    {taskReports.length > 0 ? (
                      taskReports.map((rep, idx) => {
                        const isRev = rep.comment?.startsWith('[REVISION]');
                        const cleanText = isRev ? rep.comment.replace(/^\[REVISION\]\s*/, '') : rep.comment;

                        return (
                          <div
                            key={rep.id || idx}
                            className={`p-3 rounded-xl border text-xs ${
                              isRev ? 'bg-red-50/60 border-red-200' : 'bg-gray-50 border-gray-100'
                            }`}
                          >
                            <div className="flex justify-between items-center gap-2 mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-gray-800">
                                  {rep.author ? `${rep.author.last_name} ${rep.author.first_name}` : t('task_detail.reports.employee')}
                                </span>
                                {isRev && (
                                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                                    {t('task_detail.revision_modal.badge')}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-400">
                                {new Date(rep.submitted_at).toLocaleString(dateLocale)}
                              </span>
                            </div>
                            <p className={`whitespace-pre-wrap ${isRev ? 'text-red-900 font-medium' : 'text-gray-700'}`}>
                              {cleanText}
                            </p>
                            {rep.attached_file && (
                              <button
                                type="button"
                                onClick={(e) => handleDownloadFile(e, rep.attached_file)}
                                className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-semibold"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                <span>{t('task_detail.reports.download_file')}</span>
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center text-gray-400 text-xs py-4">{t('task_detail.reports.empty')}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* МОДАЛЬНОЕ ОКНО СОЗДАНИЯ ЗАДАЧИ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">{t('tasks.modal.title')}</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {createError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold flex items-start gap-2">
                  {createError}
                </div>
              )}
              <form id="taskForm" onSubmit={handleCreateTask} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('tasks.modal.name_label')}</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('tasks.modal.desc_label')}</label>
                  <textarea
                    rows="3"
                    required
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">{t('tasks.modal.deadline_label')}</label>
                    <input
                      type="datetime-local"
                      required
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={newTask.deadline}
                      onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                    />

                    {canAssignDepartments && (
                      <div className="mt-4">
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('tasks.modal.target_dept_label')}</label>
                        <select
                          multiple
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none h-24"
                          value={newTask.target_department_ids}
                          onChange={(e) =>
                            setNewTask({ ...newTask, target_department_ids: Array.from(e.target.selectedOptions, (o) => o.value) })
                          }
                        >
                          {departments.map((d) => (
                            <option key={d.id} value={d.id} className="py-1 text-sm">
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5 gap-2">
                      <label className="block text-sm font-bold text-gray-700">{t('tasks.modal.assignees_label')}</label>
                      <button
                        type="button"
                        onClick={handleSmartPickAssignee}
                        className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>{t('tasks.modal.smart_pick_btn')}</span>
                      </button>
                    </div>

                    {recommendedInfo && (
                      <div className="mb-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold">
                            {t('tasks.modal.smart_pick_result')} {recommendedInfo.name}
                          </span>
                          <div className="text-[11px] text-emerald-600 mt-0.5">
                            {t('tasks.modal.active_load')} {recommendedInfo.activeTasks} | {t('tasks.modal.classes_load')}{' '}
                            {recommendedInfo.scheduleCount}
                            {recommendedInfo.quality > 0 ? ` | ★ ${recommendedInfo.quality}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRecommendedInfo(null)}
                          className="text-emerald-500 hover:text-emerald-800 font-bold px-1"
                        >
                          &times;
                        </button>
                      </div>
                    )}

                    <select
                      multiple
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none h-36"
                      value={newTask.assignee_ids}
                      onChange={(e) =>
                        setNewTask({ ...newTask, assignee_ids: Array.from(e.target.selectedOptions, (o) => o.value) })
                      }
                    >
                      {subordinateUsers.map((u) => {
                        const { activeTasksCount, scheduleCount } = getEmployeeMetrics(u);
                        const isWorking = u.work_status === 'working';
                        const statusText = !isWorking
                          ? ` [${t(`profile.work_statuses.${u.work_status}`, { defaultValue: u.work_status_display })}]`
                          : '';

                        return (
                          <option
                            key={u.id}
                            value={u.id}
                            className={`py-1.5 border-b border-gray-50 text-xs ${!isWorking ? 'text-gray-400' : 'text-gray-800'}`}
                          >
                            {u.last_name} {u.first_name}
                            {statusText} — {t('tasks.modal.active_load')} {activeTasksCount} | {t('tasks.modal.classes_load')}{' '}
                            {scheduleCount}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-200"
              >
                {t('tasks.modal.cancel')}
              </button>
              <button
                type="submit"
                form="taskForm"
                className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-md"
              >
                {t('tasks.modal.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}