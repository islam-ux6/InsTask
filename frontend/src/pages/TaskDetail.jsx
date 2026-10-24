import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const reportFileInputRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [task, setTask] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [parentTask, setParentTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Форма отправки отчета
  const [comment, setComment] = useState('');
  const [file, setFile] = useState(null);
  const [reportFilter, setReportFilter] = useState('all'); // 'all' | 'revisions' | 'files'
  const [submittingReport, setSubmittingReport] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // Модальное окно оценки качества (1-5 звезд)
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [qualityScore, setQualityScore] = useState(5);

  // Модальное окно возврата на доработку
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionFile, setRevisionFile] = useState(null);

  // Модальное окно создания подзадачи
  const [showSubtaskModal, setShowSubtaskModal] = useState(false);
  const [recommendedSubAssignee, setRecommendedSubAssignee] = useState(null);
  const [newSubtask, setNewSubtask] = useState({
    title: '',
    description: '',
    deadline: '',
    assignee_ids: []
  });
  const [creatingSubtask, setCreatingSubtask] = useState(false);

  const dateLocale = i18n.language === 'en' ? 'en-US' : i18n.language === 'tk' ? 'tk-TM' : 'ru-RU';

  const getUserAvatar = (userObj) => {
    if (!userObj) return null;
    return userObj.avatar || localStorage.getItem(`erp_user_avatar_${userObj.id}`) || null;
  };

  const fetchTaskData = async () => {
    try {
      const [meRes, taskRes, allTasksRes, usersRes, reportsRes] = await Promise.all([
        api.get('/users/me/'),
        api.get(`/tasks/${id}/`),
        api.get('/tasks/').catch(() => ({ data: [] })),
        api.get('/users/').catch(() => ({ data: [] })),
        api.get(`/reports/?task=${id}`).catch(() => ({ data: [] }))
      ]);

      const currentTask = taskRes.data;
      const tasksList = allTasksRes.data || [];

      setCurrentUser(meRes.data);
      setTask(currentTask);
      setAllTasks(tasksList);
      setUsers(usersRes.data || []);
      setReports(currentTask.reports || reportsRes.data || []);

      const childTasks = currentTask.subtasks || tasksList.filter((item) => item.parent_task === Number(id));
      setSubtasks(childTasks);

      if (currentTask.parent_task) {
        const foundParent = tasksList.find((item) => item.id === currentTask.parent_task);
        setParentTask(foundParent || { id: currentTask.parent_task, title: `#${currentTask.parent_task}` });
      } else {
        setParentTask(null);
      }
    } catch (error) {
      console.error('Ошибка загрузки задачи:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskData();
  }, [id]);

  const handleStatusChange = async (newStatus, score = null) => {
    if (isChangingStatus) return;
    setIsChangingStatus(true);

    try {
      const payload = { status: newStatus };
      if (score !== null) {
        payload.quality_score = score;
      }
      await api.patch(`/tasks/${id}/`, payload);
      setShowQualityModal(false);
      await fetchTaskData();
    } catch (error) {
      const serverMsg = error.response?.data?.status?.[0] || t('tasks.errors.status_change');
      alert(serverMsg);
      console.error(error);
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleReturnToRevision = async (e) => {
    e.preventDefault();
    if (!revisionReason.trim() || isChangingStatus) return;

    setIsChangingStatus(true);
    try {
      const formData = new FormData();
      formData.append('task', id);
      formData.append('comment', `[REVISION] ${revisionReason.trim()}`);
      if (revisionFile) {
        formData.append('attached_file', revisionFile);
      }

      await api.post('/reports/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await api.patch(`/tasks/${id}/`, { status: 'revision' });

      setShowRevisionModal(false);
      setRevisionReason('');
      setRevisionFile(null);
      await fetchTaskData();
    } catch (error) {
      const serverMsg = error.response?.data?.status?.[0] || t('tasks.errors.status_change');
      alert(serverMsg);
      console.error(error);
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleAcceptClick = () => {
    const hasIncompleteSubtasks = subtasks.some((s) => s.status !== 'completed');
    if (hasIncompleteSubtasks) {
      alert(t('task_detail.subtasks.incomplete_warning'));
      return;
    }
    setShowQualityModal(true);
  };

  const handleCreateSubtask = async (e) => {
    e.preventDefault();
    if (newSubtask.assignee_ids.length === 0) {
      alert(t('tasks.modal.error_assignee'));
      return;
    }
    setCreatingSubtask(true);
    try {
      await api.post('/tasks/', {
        ...newSubtask,
        parent_task: task.id,
        creator_id: currentUser.id
      });
      setShowSubtaskModal(false);
      setRecommendedSubAssignee(null);
      setNewSubtask({ title: '', description: '', deadline: '', assignee_ids: [] });
      await fetchTaskData();
    } catch (error) {
      alert(t('tasks.modal.error_create'));
      console.error(error);
    } finally {
      setCreatingSubtask(false);
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setSubmittingReport(true);
    try {
      const formData = new FormData();
      formData.append('task', id);
      formData.append('comment', comment);
      if (file) formData.append('attached_file', file);

      await api.post('/reports/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setComment('');
      setFile(null);
      if (reportFileInputRef.current) reportFileInputRef.current.value = '';
      await fetchTaskData();
    } catch (error) {
      alert('Ошибка при отправке отчета');
      console.error(error);
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleDownload = async (e, fileUrl) => {
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
      console.error('Ошибка при скачивании файла:', error);
      window.open(fileUrl, '_blank');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">{t('task_detail.loading')}</div>;
  }
  if (!task || !currentUser) {
    return <div className="text-center text-gray-500 mt-20">{t('task_detail.not_found')}</div>;
  }

  // Расчет времени по каждому статусу
  let timeMetrics = { created: 0, in_progress: 0, on_review: 0, revision: 0, completed: 0 };
  if (task.status_logs && task.status_logs.length > 0) {
    task.status_logs.forEach((log) => {
      if (timeMetrics[log.status] !== undefined) timeMetrics[log.status] += log.hours_spent || 0;
    });
  }
  Object.keys(timeMetrics).forEach((key) => {
    timeMetrics[key] = parseFloat(timeMetrics[key].toFixed(1));
  });
  const totalHoursSpent = parseFloat(
    (timeMetrics.created + timeMetrics.in_progress + timeMetrics.on_review + timeMetrics.revision).toFixed(1)
  );

  const timeData = [
    {
      name: 'Time',
      [t('dashboard.charts.funnel.created')]: timeMetrics.created,
      [t('dashboard.charts.funnel.in_progress')]: timeMetrics.in_progress,
      [t('dashboard.charts.funnel.on_review')]: timeMetrics.on_review,
      [t('dashboard.charts.funnel.revision')]: timeMetrics.revision
    }
  ];

  // Индикация дедлайна
  const deadlineDate = new Date(task.deadline);
  const now = new Date();
  const diffMs = deadlineDate - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isOverdue = diffMs < 0 && task.status !== 'completed';

  const getDeadlineBadge = () => {
    if (task.status === 'completed') {
      return {
        text: t('tasks.status.completed'),
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    }
    if (isOverdue) {
      return {
        text: `${t('task_detail.overdue')} (${Math.abs(diffDays)} ${t('tasks.card.days_left')})`,
        cls: 'bg-red-500 text-white border-red-600 animate-pulse'
      };
    }
    if (diffDays <= 1) {
      return {
        text: t('tasks.card.today'),
        cls: 'bg-amber-100 text-amber-800 border-amber-200'
      };
    }
    return {
      text: `${diffDays} ${t('tasks.card.days_left')}`,
      cls: 'bg-blue-50 text-blue-700 border-blue-200'
    };
  };
  const deadlineBadge = getDeadlineBadge();

  // Роли и права
  const isDirectAssignee = task.assignees?.some((a) => a.id === currentUser.id);
  const isInTargetDept = Boolean(
    currentUser.department && task.target_departments?.some((d) => d.id === currentUser.department)
  );
  const isAssignee = isDirectAssignee || isInTargetDept;
  const isCreator = task.creator?.id === currentUser.id;
  const canReview = isCreator || currentUser.is_rectorate;
  const canManageSubtasks = (isCreator || isAssignee) && (currentUser.is_manager || currentUser.is_rectorate);

  // Метрики нагрузки для автоподбора исполнителя подзадачи
  const getEmpLoad = (u) => {
    const activeCount = allTasks.filter(
      (item) => item.status !== 'completed' && item.assignees?.some((a) => a.id === u.id)
    ).length;
    let classesCount = 0;
    if (u.schedule) {
      const odd = Object.values(u.schedule.odd || {}).reduce((acc, arr) => acc + arr.length, 0);
      const even = Object.values(u.schedule.even || {}).reduce((acc, arr) => acc + arr.length, 0);
      classesCount = Math.round((odd + even) / 2);
    }
    return { activeCount, classesCount };
  };

  const subordinateUsers = users
    .filter((u) => {
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
    })
    .sort((a, b) => {
      const aWork = a.work_status === 'working' ? 0 : 1;
      const bWork = b.work_status === 'working' ? 0 : 1;
      if (aWork !== bWork) return aWork - bWork;
      return getEmpLoad(a).activeCount - getEmpLoad(b).activeCount;
    });

  const handleSmartPickSubtaskAssignee = () => {
    const workingCandidates = subordinateUsers.filter((u) => u.work_status === 'working');
    if (workingCandidates.length === 0) {
      alert(t('tasks.modal.smart_pick_none'));
      return;
    }
    const best = workingCandidates[0];
    const load = getEmpLoad(best);
    setNewSubtask((prev) => ({ ...prev, assignee_ids: [String(best.id)] }));
    setRecommendedSubAssignee({
      name: `${best.last_name} ${best.first_name}`,
      activeCount: load.activeCount,
      classesCount: load.classesCount
    });
  };

  const completedSubtasksCount = subtasks.filter((s) => s.status === 'completed').length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedSubtasksCount / subtasks.length) * 100) : 0;

  //Этапы самой задачи (1/4 -> 2/4 -> 3/4 -> 4/4), если подзадач нет
  const stepOrder = ['created', 'in_progress', 'on_review', 'completed'];
  const currentStepIndex = task.status === 'revision' ? 1 : stepOrder.indexOf(task.status);
  const stageNumber = task.status === 'completed' ? 4 : Math.max(1, currentStepIndex + 1);
  const stagePercent = Math.round((stageNumber / 4) * 100);

  // Фильтрация ленты отчетов
  const filteredReports = reports.filter((rep) => {
    if (reportFilter === 'revisions') return rep.comment?.startsWith('[REVISION]');
    if (reportFilter === 'files') return Boolean(rep.attached_file);
    return true;
  });

  const steps = [
    { key: 'created', label: t('task_detail.stepper.created') },
    {
      key: 'in_progress',
      label: task.status === 'revision' ? t('tasks.status.revision') : t('task_detail.stepper.in_progress'),
      isRevision: task.status === 'revision'
    },
    { key: 'on_review', label: t('task_detail.stepper.on_review') },
    { key: 'completed', label: t('task_detail.stepper.completed') }
  ];

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6">
      {/* 1. НАВИГАЦИОННАЯ ПАНЕЛЬ (ХЛЕБНЫЕ КРОШКИ) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/tasks')}
            className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>{t('task_detail.back')}</span>
          </button>

          <span className="text-xs font-bold text-gray-400">
            {t('task_detail.task_number')} #{task.id}
          </span>
        </div>

        {parentTask && (
          <Link
            to={`/tasks/${parentTask.id}`}
            className="inline-flex items-center gap-2 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-xl hover:bg-indigo-100 transition shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span>
              {t('task_detail.parent_task_link')} {parentTask.title}
            </span>
          </Link>
        )}
      </div>

      {/* 2. ГЛАВНАЯ КАРТОЧКА ЗАДАЧИ С ТРЕКЕРОМ ЭТАПОВ (STEPPER) */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Визуальный трекер этапов */}
        <div className="bg-gray-50/80 border-b border-gray-100 px-6 py-4">
          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            {steps.map((step, index) => {
              const isCompletedStep = currentStepIndex > index || task.status === 'completed';
              const isCurrentStep = currentStepIndex === index && task.status !== 'completed';

              return (
                <div key={step.key} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 transition-all ${
                        isCompletedStep
                          ? 'bg-emerald-500 text-white'
                          : isCurrentStep
                          ? step.isRevision
                            ? 'bg-red-600 text-white ring-4 ring-red-100'
                            : 'bg-blue-600 text-white ring-4 ring-blue-100'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isCompletedStep ? '✓' : index + 1}
                    </div>
                    <span
                      className={`text-xs font-bold truncate ${
                        isCompletedStep
                          ? 'text-emerald-700'
                          : isCurrentStep
                          ? step.isRevision
                            ? 'text-red-700'
                            : 'text-blue-700'
                          : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isCompletedStep
                          ? 'w-full bg-emerald-500'
                          : isCurrentStep
                          ? step.isRevision
                            ? 'w-2/3 bg-red-500'
                            : 'w-2/3 bg-blue-600'
                          : 'w-0'
                      }`}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Основное содержимое шапки и кнопки управления */}
        <div className="p-6 sm:p-8 flex flex-col lg:flex-row justify-between items-start gap-6">
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`text-xs uppercase tracking-wider font-extrabold px-3 py-1 rounded-full ${
                  task.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : task.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-800'
                    : task.status === 'revision'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {t(`tasks.status.${task.status}`)}
              </span>

              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${deadlineBadge.cls}`}>
                {deadlineBadge.text}
              </span>

              {task.quality_score && (
                <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs font-extrabold px-3 py-1 rounded-full">
                  ★ {task.quality_score} / 5
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">{task.title}</h1>

            <div className="bg-gray-50/80 border border-gray-100 rounded-2xl p-5 text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
              {task.description}
            </div>
          </div>

          {/* Панель действий по задаче */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-60 shrink-0">
            {task.status === 'created' && isAssignee && (
              <button
                disabled={isChangingStatus}
                onClick={() => handleStatusChange('in_progress')}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm transition bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white shadow-md flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{isChangingStatus ? t('task_detail.actions.processing') : t('task_detail.actions.take_in_progress')}</span>
              </button>
            )}

            {(task.status === 'in_progress' || task.status === 'revision') && isAssignee && (
              <button
                disabled={isChangingStatus}
                onClick={() => handleStatusChange('on_review')}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm transition bg-amber-500 hover:bg-amber-600 disabled:bg-gray-400 text-white shadow-md flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{isChangingStatus ? t('task_detail.actions.processing') : t('task_detail.actions.send_to_review')}</span>
              </button>
            )}

            {task.status === 'on_review' && canReview && (
              <>
                <button
                  disabled={isChangingStatus}
                  onClick={handleAcceptClick}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm transition bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white shadow-md flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{t('task_detail.actions.accept')}</span>
                </button>

                <button
                  disabled={isChangingStatus}
                  onClick={() => setShowRevisionModal(true)}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm transition bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white shadow-md flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  <span>{t('task_detail.actions.return_revision')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. БЫСТРЫЕ МЕТРИКИ ЗАДАЧИ (4 КАРТОЧКИ) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">{t('task_detail.metrics.total_hours')}</p>
            <p className="text-2xl font-black text-gray-900 mt-1">
              {totalHoursSpent} <span className="text-sm font-semibold text-gray-400">{t('task_detail.timeline.hours')}</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">
              {subtasks.length > 0 ? t('task_detail.subtasks.title') : t('task_detail.metrics.subtasks')}
            </p>
            {subtasks.length > 0 ? (
              <p className="text-2xl font-black text-indigo-600 mt-1">
                {completedSubtasksCount}/{subtasks.length}{' '}
                <span className="text-sm font-semibold text-gray-400">({subtaskProgress}%)</span>
              </p>
            ) : (
              <p className="text-2xl font-black text-indigo-600 mt-1">
                {stageNumber}/4{' '}
                <span className="text-sm font-semibold text-gray-400">({stagePercent}%)</span>
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">{t('task_detail.metrics.revisions')}</p>
            <p className={`text-2xl font-black mt-1 ${task.revision_count > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {task.revision_count}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">{t('task_detail.metrics.reports')}</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{reports.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 4. ОСНОВНАЯ СЕТКА СТРАНИЦЫ (2/3 ЛЕВАЯ КОЛОНКА + 1/3 ПРАВАЯ КОЛОНКА) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* БЛОК 1: ДЕРЕВО ПОДЗАДАЧ */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-5 rounded-full bg-indigo-600"></div>
                <h3 className="font-bold text-gray-800 text-lg">
                  {t('task_detail.subtasks.title')} ({completedSubtasksCount}/{subtasks.length})
                </h3>
              </div>
              {canManageSubtasks && task.status !== 'completed' && subordinateUsers.length > 0 && (
                <button
                  onClick={() => {
                    setRecommendedSubAssignee(null);
                    setShowSubtaskModal(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  {t('task_detail.subtasks.add_btn')}
                </button>
              )}
            </div>

            {subtasks.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <div className="flex justify-between text-xs font-bold text-gray-600 mb-1.5">
                    <span>{t('task_detail.subtasks.progress')}</span>
                    <span>{subtaskProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${subtaskProgress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {subtasks.map((sub) => {
                    const subOverdue = new Date(sub.deadline) < new Date() && sub.status !== 'completed';
                    return (
                      <div
                        key={sub.id}
                        onClick={() => navigate(`/tasks/${sub.id}`)}
                        className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between gap-4 group ${
                          sub.status === 'completed'
                            ? 'bg-gray-50/60 border-gray-100'
                            : subOverdue
                            ? 'bg-red-50/30 border-red-200 hover:border-red-300'
                            : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              sub.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-indigo-50 text-indigo-600'
                            }`}
                          >
                            {sub.status === 'completed' ? '✓' : '•'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`font-bold text-sm truncate group-hover:text-indigo-600 transition-colors ${
                                sub.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'
                              }`}
                            >
                              {sub.title}
                            </p>
                            <p className={`text-xs mt-0.5 ${subOverdue ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                              {new Date(sub.deadline).toLocaleDateString(dateLocale, {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex -space-x-1.5">
                            {sub.assignees?.slice(0, 3).map((a, idx) => {
                              const av = getUserAvatar(a);
                              return av ? (
                                <img
                                  key={idx}
                                  src={av}
                                  alt={a.last_name}
                                  className="w-7 h-7 rounded-full object-cover border-2 border-white shadow-sm"
                                  title={`${a.last_name} ${a.first_name}`}
                                />
                              ) : (
                                <div
                                  key={idx}
                                  className="w-7 h-7 rounded-full bg-blue-600 text-white border-2 border-white flex items-center justify-center text-[10px] font-bold shadow-sm"
                                  title={`${a.last_name} ${a.first_name}`}
                                >
                                  {a.last_name?.charAt(0)}
                                </div>
                              );
                            })}
                          </div>

                          <span
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                              sub.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : sub.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-700'
                                : sub.status === 'revision'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {t(`tasks.status.${sub.status}`)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 text-sm py-8 border-2 border-dashed border-gray-100 rounded-2xl">
                {t('task_detail.subtasks.empty')}
              </div>
            )}
          </div>

          {/* БЛОК 2: ТАЙМЛАЙН ЗАДЕРЖЕК И ХРОНОЛОГИЯ СТАТУСОВ */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-2 h-5 rounded-full bg-blue-600"></div>
              <h3 className="font-bold text-gray-800 text-lg">{t('task_detail.timeline.title')}</h3>
            </div>
            <p className="text-xs text-gray-500 mb-6">{t('task_detail.timeline.subtitle')}</p>

            {task.status_logs && task.status_logs.length > 0 ? (
              <div className="w-full space-y-6">
                <ResponsiveContainer width="100%" height={95}>
                  <BarChart data={timeData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                    <YAxis type="category" dataKey="name" hide />
                    <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }} />
                    <Bar dataKey={t('dashboard.charts.funnel.created')} stackId="a" fill="#9ca3af" name={t('task_detail.timeline.wait')} radius={[6, 0, 0, 6]} />
                    <Bar dataKey={t('dashboard.charts.funnel.in_progress')} stackId="a" fill="#3b82f6" name={t('task_detail.timeline.in_progress')} />
                    <Bar dataKey={t('dashboard.charts.funnel.on_review')} stackId="a" fill="#f59e0b" name={t('task_detail.timeline.review')} />
                    <Bar dataKey={t('dashboard.charts.funnel.revision')} stackId="a" fill="#ef4444" name={t('task_detail.timeline.revision')} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-gray-400 font-bold uppercase">{t('task_detail.timeline.wait')}</p>
                    <p className="text-lg font-black text-gray-700 mt-0.5">
                      {timeMetrics.created} <span className="text-xs font-normal">{t('task_detail.timeline.hours')}</span>
                    </p>
                  </div>
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-blue-500 font-bold uppercase">{t('task_detail.timeline.in_progress')}</p>
                    <p className="text-lg font-black text-blue-700 mt-0.5">
                      {timeMetrics.in_progress} <span className="text-xs font-normal">{t('task_detail.timeline.hours')}</span>
                    </p>
                  </div>
                  <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-amber-600 font-bold uppercase">{t('task_detail.timeline.review')}</p>
                    <p className="text-lg font-black text-amber-700 mt-0.5">
                      {timeMetrics.on_review} <span className="text-xs font-normal">{t('task_detail.timeline.hours')}</span>
                    </p>
                  </div>
                  <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-red-500 font-bold uppercase">{t('task_detail.timeline.revision')}</p>
                    <p className="text-lg font-black text-red-600 mt-0.5">
                      {timeMetrics.revision} <span className="text-xs font-normal">{t('task_detail.timeline.hours')}</span>
                    </p>
                  </div>
                </div>

                {/* Детальная хронология переходов */}
                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    {t('task_detail.timeline.history_title')}
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {task.status_logs.map((log, idx) => (
                      <div
                        key={log.id || idx}
                        className="flex items-center justify-between text-xs bg-gray-50/70 border border-gray-100 px-3.5 py-2 rounded-xl"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              log.status === 'completed'
                                ? 'bg-emerald-500'
                                : log.status === 'in_progress'
                                ? 'bg-blue-500'
                                : log.status === 'revision'
                                ? 'bg-red-500'
                                : log.status === 'on_review'
                                ? 'bg-amber-500'
                                : 'bg-gray-400'
                            }`}
                          ></span>
                          <span className="font-bold text-gray-800">{t(`tasks.status.${log.status}`)}</span>
                        </div>
                        <div className="text-gray-500 font-medium">
                          {new Date(log.entered_at).toLocaleString(dateLocale, {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                          {log.exited_at ? (
                            ` — ${new Date(log.exited_at).toLocaleTimeString(dateLocale, {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}`
                          ) : (
                            <span className="ml-2 text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              {t('task_detail.timeline.active_now')}
                            </span>
                          )}
                        </div>
                        <span className="font-extrabold text-gray-700">
                          {parseFloat((log.hours_spent || 0).toFixed(1))} {t('task_detail.timeline.hours')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-6">{t('task_detail.timeline.no_data')}</div>
            )}
          </div>

          {/* БЛОК 3: ОТЧЕТЫ, ФАЙЛЫ И ОБСУЖДЕНИЕ */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-5 rounded-full bg-emerald-600"></div>
                <h3 className="font-bold text-gray-800 text-lg">
                  {t('task_detail.reports.title')} ({reports.length})
                </h3>
              </div>

              {/* Фильтры ленты */}
              <div className="flex gap-1.5 bg-white p-1 rounded-xl border border-gray-200">
                {['all', 'revisions', 'files'].map((fKey) => (
                  <button
                    key={fKey}
                    type="button"
                    onClick={() => setReportFilter(fKey)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      reportFilter === fKey ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {t(`task_detail.reports.filters.${fKey}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Форма отправки нового отчета */}
            {(isAssignee || canReview) && task.status !== 'completed' && (
              <div className="p-6 border-b border-gray-100 bg-white">
                <form onSubmit={handleSubmitReport} className="space-y-3">
                  <textarea
                    rows="3"
                    required
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t('task_detail.reports.placeholder')}
                    className="w-full border border-gray-200 rounded-2xl p-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
                  ></textarea>

                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        ref={reportFileInputRef}
                        type="file"
                        onChange={(e) => setFile(e.target.files[0])}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => reportFileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-bold transition"
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span>{file ? file.name : t('task_detail.reports.attach_btn')}</span>
                      </button>

                      {file && (
                        <button
                          type="button"
                          onClick={() => {
                            setFile(null);
                            if (reportFileInputRef.current) reportFileInputRef.current.value = '';
                          }}
                          className="text-xs font-bold text-red-500 hover:text-red-700 px-1"
                        >
                          &times;
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={submittingReport}
                      className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-blue-700 disabled:bg-blue-300 transition shadow-sm"
                    >
                      {submittingReport ? t('task_detail.reports.submitting') : t('task_detail.reports.submit_btn')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Список отчетов */}
            <div className="p-6 space-y-5">
              {filteredReports.length > 0 ? (
                filteredReports.map((rep, index) => {
                  const isRevisionRemark = rep.comment?.startsWith('[REVISION]');
                  const cleanComment = isRevisionRemark ? rep.comment.replace(/^\[REVISION\]\s*/, '') : rep.comment;
                  const authorAvatar = getUserAvatar(rep.author);

                  return (
                    <div key={rep.id || index} className="flex gap-4">
                      {authorAvatar ? (
                        <img
                          src={authorAvatar}
                          alt={rep.author?.last_name}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200 shrink-0 shadow-sm"
                        />
                      ) : (
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 shadow-sm ${
                            isRevisionRemark ? 'bg-red-100 text-red-700' : 'bg-blue-600 text-white'
                          }`}
                        >
                          {rep.author?.last_name ? rep.author.last_name.charAt(0) : 'U'}
                        </div>
                      )}

                      <div
                        className={`flex-1 p-4 rounded-2xl rounded-tl-none border ${
                          isRevisionRemark ? 'bg-red-50/60 border-red-200' : 'bg-gray-50/80 border-gray-100'
                        }`}
                      >
                        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-sm">
                              {rep.author ? `${rep.author.last_name} ${rep.author.first_name}` : t('task_detail.reports.employee')}
                            </span>
                            {isRevisionRemark && (
                              <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                                {t('task_detail.revision_modal.badge')}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 font-medium">
                            {new Date(rep.submitted_at).toLocaleString(dateLocale)}
                          </span>
                        </div>

                        <p
                          className={`text-sm whitespace-pre-wrap leading-relaxed ${
                            isRevisionRemark ? 'text-red-900 font-medium' : 'text-gray-700'
                          }`}
                        >
                          {cleanComment}
                        </p>

                        {rep.attached_file && (
                          <div className="mt-3 pt-3 border-t border-gray-200/60">
                            <button
                              type="button"
                              onClick={(e) => handleDownload(e, rep.attached_file)}
                              className="inline-flex items-center gap-2 text-xs text-blue-700 hover:bg-blue-100 font-bold bg-blue-50 border border-blue-200 px-3.5 py-2 rounded-xl transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              <span>{t('task_detail.reports.download_file')}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-gray-400 py-8 border-2 border-dashed border-gray-100 rounded-2xl text-sm">
                  {t('task_detail.reports.empty')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА (1/3): ПАСПОРТ ЗАДАЧИ И ОТВЕТСТВЕННЫЕ ЛИЦА */}
        <div className="space-y-6">
          {/* Карточка: Паспорт поручения */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-3 mb-4 text-sm uppercase tracking-wider">
              {t('task_detail.info.title')}
            </h3>

            <div className="space-y-4 text-sm">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-400 font-semibold mb-1">{t('task_detail.info.deadline')}</p>
                <p className={`font-extrabold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                  {new Date(task.deadline).toLocaleString(dateLocale)}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 px-1">
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">{t('task_detail.info.created_at')}</p>
                  <p className="text-gray-800 font-bold">{new Date(task.created_at).toLocaleString(dateLocale)}</p>
                </div>

                {task.completed_at && (
                  <div>
                    <p className="text-xs text-gray-400 font-medium mb-0.5">{t('task_detail.info.completed_at')}</p>
                    <p className="text-emerald-700 font-bold">{new Date(task.completed_at).toLocaleString(dateLocale)}</p>
                  </div>
                )}
              </div>

              {/* Постановщик задачи */}
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 font-semibold mb-2">{t('task_detail.info.creator')}</p>
                {task.creator && (
                  <Link
                    to={`/profile/${task.creator.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/40 transition"
                  >
                    {getUserAvatar(task.creator) ? (
                      <img
                        src={getUserAvatar(task.creator)}
                        alt={task.creator.last_name}
                        className="w-9 h-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                        {task.creator.last_name?.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">
                        {task.creator.last_name} {task.creator.first_name}
                      </p>
                      {task.creator.position && task.creator.position !== 'none' && (
                        <p className="text-[11px] text-gray-500 truncate">
                          {t(`profile.positions.${task.creator.position}`, { defaultValue: task.creator.position })}
                        </p>
                      )}
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Карточка: Исполнители и Целевые кафедры */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-3 mb-4 text-sm uppercase tracking-wider">
              {t('task_detail.info.assignees_title')} ({task.assignees?.length || 0})
            </h3>

            {task.assignees && task.assignees.length > 0 ? (
              <div className="space-y-2.5">
                {task.assignees.map((emp) => {
                  const empAvatar = getUserAvatar(emp);
                  return (
                    <Link
                      key={emp.id}
                      to={`/profile/${emp.id}`}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/40 transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {empAvatar ? (
                          <img src={empAvatar} alt={emp.last_name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {emp.last_name?.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-800 group-hover:text-blue-600 truncate transition-colors">
                            {emp.last_name} {emp.first_name}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">@{emp.username}</p>
                        </div>
                      </div>
                      <span className="text-gray-300 group-hover:text-blue-600 font-bold">&rarr;</span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-2">{t('task_detail.info.no_assignees')}</p>
            )}

            {task.target_departments && task.target_departments.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <h4 className="font-bold text-gray-400 uppercase tracking-wider mb-3 text-xs">
                  {t('task_detail.info.target_depts')}
                </h4>
                <div className="space-y-2">
                  {task.target_departments.map((dept) => (
                    <Link
                      key={dept.id}
                      to={`/departments?dept=${dept.id}`}
                      className="flex items-center justify-between text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-100 px-3.5 py-2.5 rounded-xl transition"
                    >
                      <span>{dept.name}</span>
                      <span>&rarr;</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* МОДАЛЬНОЕ ОКНО: ОЦЕНКА КАЧЕСТВА (1-5 ЗВЕЗД) */}
      {showQualityModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-800 text-lg">{t('task_detail.quality_modal.title')}</h3>
              <button onClick={() => setShowQualityModal(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">
                &times;
              </button>
            </div>
            <p className="text-sm text-gray-500">{t('task_detail.quality_modal.subtitle')}</p>

            <div className="flex justify-center gap-3 py-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setQualityScore(star)}
                  className={`w-12 h-12 rounded-xl font-black text-xl transition-all border ${
                    qualityScore >= star
                      ? 'bg-yellow-400 text-white border-yellow-500 shadow-md scale-105'
                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowQualityModal(false)}
                className="px-4 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100"
              >
                {t('tasks.modal.cancel')}
              </button>
              <button
                type="button"
                disabled={isChangingStatus}
                onClick={() => handleStatusChange('completed', qualityScore)}
                className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-md"
              >
                {t('task_detail.quality_modal.confirm')} ({qualityScore}/5)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: ВОЗВРАТ НА ДОРАБОТКУ */}
      {showRevisionModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-red-100 bg-red-50 flex justify-between items-center">
              <h3 className="font-bold text-red-800 text-lg">{t('task_detail.revision_modal.title')}</h3>
              <button onClick={() => setShowRevisionModal(false)} className="text-red-400 hover:text-red-700 text-2xl leading-none">
                &times;
              </button>
            </div>

            <form onSubmit={handleReturnToRevision} className="p-6 space-y-4">
              <p className="text-sm text-gray-600">{t('task_detail.revision_modal.subtitle')}</p>

              <div>
                <textarea
                  rows="4"
                  required
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  placeholder={t('task_detail.revision_modal.placeholder')}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none resize-none"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  {t('task_detail.revision_modal.attach_file')}
                </label>
                <input
                  type="file"
                  onChange={(e) => setRevisionFile(e.target.files[0])}
                  className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRevisionModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 font-bold text-sm hover:bg-gray-100"
                >
                  {t('tasks.modal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isChangingStatus || !revisionReason.trim()}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-xl font-bold text-sm transition shadow-md"
                >
                  {isChangingStatus ? t('task_detail.actions.processing') : t('task_detail.revision_modal.confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: СОЗДАНИЕ ПОДЗАДАЧИ С УМНЫМ АВТОПОДБОРОМ */}
      {showSubtaskModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-lg">{t('task_detail.subtasks.modal_title')}</h3>
              <button onClick={() => setShowSubtaskModal(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateSubtask} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{t('tasks.modal.name_label')}</label>
                <input
                  type="text"
                  required
                  value={newSubtask.title}
                  onChange={(e) => setNewSubtask({ ...newSubtask, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{t('tasks.modal.desc_label')}</label>
                <textarea
                  rows="3"
                  required
                  value={newSubtask.description}
                  onChange={(e) => setNewSubtask({ ...newSubtask, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{t('tasks.modal.deadline_label')}</label>
                <input
                  type="datetime-local"
                  required
                  value={newSubtask.deadline}
                  onChange={(e) => setNewSubtask({ ...newSubtask, deadline: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5 gap-2">
                  <label className="block text-sm font-bold text-gray-700">{t('tasks.modal.assignees_label')}</label>
                  <button
                    type="button"
                    onClick={handleSmartPickSubtaskAssignee}
                    className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>{t('tasks.modal.smart_pick_btn')}</span>
                  </button>
                </div>

                {recommendedSubAssignee && (
                  <div className="mb-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                    <span>
                      <strong>{t('tasks.modal.smart_pick_result')}</strong> {recommendedSubAssignee.name} (
                      {t('tasks.modal.active_load')} {recommendedSubAssignee.activeCount} | {t('tasks.modal.classes_load')}{' '}
                      {recommendedSubAssignee.classesCount})
                    </span>
                    <button
                      type="button"
                      onClick={() => setRecommendedSubAssignee(null)}
                      className="text-emerald-600 font-bold px-1"
                    >
                      &times;
                    </button>
                  </div>
                )}

                <select
                  multiple
                  value={newSubtask.assignee_ids}
                  onChange={(e) =>
                    setNewSubtask({ ...newSubtask, assignee_ids: Array.from(e.target.selectedOptions, (o) => o.value) })
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none h-32"
                >
                  {subordinateUsers.map((u) => {
                    const { activeCount, classesCount } = getEmpLoad(u);
                    return (
                      <option key={u.id} value={u.id} className="py-1 text-xs">
                        {u.last_name} {u.first_name} — {t('tasks.modal.active_load')} {activeCount} |{' '}
                        {t('tasks.modal.classes_load')} {classesCount}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubtaskModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100"
                >
                  {t('tasks.modal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creatingSubtask}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md"
                >
                  {t('tasks.modal.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}