import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  ResponsiveContainer,
  Line,
  ComposedChart,
  Cell,
  ReferenceLine,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie
} from 'recharts';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  const [chartTarget, setChartTarget] = useState('all_emps');
  const [selectedId, setSelectedId] = useState('');

  const dateLocale = i18n.language === 'en' ? 'en-US' : i18n.language === 'tk' ? 'tk-TM' : 'ru-RU';

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [meRes, tasksRes, analyticsRes] = await Promise.all([
          api.get('/users/me/'),
          api.get('/tasks/').catch(() => ({ data: [] })),
          api.get('/analytics/dashboard/').catch(() => ({ data: null }))
        ]);

        const user = meRes.data;
        setCurrentUser(user);
        setTasks(tasksRes.data || []);

        const data = analyticsRes.data;
        setAnalytics(data);

        if (data?.scope === 'institute') {
          setChartTarget('all_depts');
        } else if (data?.scope === 'personal') {
          setChartTarget('single');
          setSelectedId(String(user.id));
        }
      } catch (error) {
        console.error('Ошибка загрузки:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  // Быстрая отметка посещаемости прямо с главной страницы
  const handleQuickCheckIn = async () => {
    setCheckingIn(true);
    try {
      await api.post('/users/checkin/');
      const [meRes, analyticsRes] = await Promise.all([
        api.get('/users/me/'),
        api.get('/analytics/dashboard/').catch(() => ({ data: analytics }))
      ]);
      setCurrentUser(meRes.data);
      if (analyticsRes.data) setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error('Ошибка при отметке явки:', err);
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading) {
    return <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center text-gray-500">...</div>;
  }
  if (!currentUser) return null;

  const isAdmin = currentUser.is_rectorate || currentUser.is_manager;
  const savedAvatar = currentUser.avatar || localStorage.getItem(`erp_user_avatar_${currentUser.id}`);

  // Проверка сегодняшней отметки посещаемости
  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(
    todayObj.getDate()
  ).padStart(2, '0')}`;
  const isCheckedInToday = Boolean(currentUser.attendance_history && currentUser.attendance_history[todayStr]);

  // Задачи, требующие внимания
  const tasksAwaitingMyReview = tasks.filter(
    (item) => item.status === 'on_review' && (item.creator?.id === currentUser.id || currentUser.is_rectorate)
  );

  const myActiveTasks = tasks
    .filter(
      (item) =>
        item.status !== 'completed' &&
        (item.assignees?.some((a) => a.id === currentUser.id) ||
          (currentUser.department && item.target_departments?.some((d) => d.id === currentUser.department)))
    )
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const priorityList = isAdmin
    ? [
        ...tasksAwaitingMyReview,
        ...tasks.filter(
          (item) =>
            item.status !== 'completed' &&
            item.status !== 'on_review' &&
            new Date(item.deadline) < new Date()
        )
      ].slice(0, 6)
    : myActiveTasks.slice(0, 6);

  // Определение сегодняшнего расписания преподавателя
  const jsDayIndex = todayObj.getDay(); // 0 = Вс, 1 = Пн ... 6 = Сб
  const ruDaysMap = {
    1: 'Понедельник',
    2: 'Вторник',
    3: 'Среда',
    4: 'Четверг',
    5: 'Пятница',
    6: 'Суббота'
  };
  const todayRuKey = ruDaysMap[jsDayIndex];
  const weekNumber = Math.ceil(((todayObj - new Date(todayObj.getFullYear(), 0, 1)) / 86400000 + 1) / 7);
  const currentParity = weekNumber % 2 === 1 ? 'odd' : 'even';
  const todayClasses =
    todayRuKey && currentUser.schedule?.[currentParity]?.[todayRuKey]
      ? currentUser.schedule[currentParity][todayRuKey]
      : [];

  // Топ-5 сотрудников по рейтингу
  const topEmployees = [...(analytics?.employees || [])]
    .sort((a, b) => {
      if (b.completion_rate !== a.completion_rate) return b.completion_rate - a.completion_rate;
      return b.quality - a.quality;
    })
    .slice(0, 5);

  // ЭКСПОРТ АНАЛИТИКИ В EXCEL (CSV С UTF-8 BOM)
  const handleExportAnalyticsCSV = () => {
    if (!analytics) return;

    const escapeCSV = (val) => {
      const str = String(val ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };

    const isDeptExport = chartTarget === 'all_depts' || chartTarget === 'bottlenecks_depts';
    let rows = [];
    let filename = 'analytics_report.csv';

    if (isDeptExport && analytics.departments?.length > 0) {
      const headers = [
        t('dashboard.csv_headers.name'),
        t('dashboard.csv_headers.total_tasks'),
        t('dashboard.csv_headers.completed'),
        t('dashboard.csv_headers.completion_rate'),
        t('dashboard.csv_headers.quality'),
        t('dashboard.csv_headers.active_tasks'),
        t('dashboard.csv_headers.in_progress_h'),
        t('dashboard.csv_headers.on_review_h'),
        t('dashboard.csv_headers.revision_h')
      ];
      rows.push(headers.map(escapeCSV).join(';'));

      analytics.departments.forEach((dept) => {
        const activeCount =
          (dept.statuses?.created || 0) +
          (dept.statuses?.in_progress || 0) +
          (dept.statuses?.revision || 0);
        const row = [
          dept.name,
          dept.total,
          dept.completed,
          dept.completion_rate,
          dept.quality,
          activeCount,
          dept.cycle_time?.in_progress || 0,
          dept.cycle_time?.on_review || 0,
          dept.cycle_time?.revision || 0
        ];
        rows.push(row.map(escapeCSV).join(';'));
      });
      filename = `analytics_departments_${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      let empsToExport = analytics.employees || [];
      if (chartTarget === 'all_emps_in_dept' && selectedId) {
        empsToExport = empsToExport.filter((e) => e.department_id === parseInt(selectedId));
      } else if (chartTarget === 'single' && selectedId) {
        empsToExport = empsToExport.filter((e) => e.id === parseInt(selectedId));
      }

      const headers = [
        t('dashboard.csv_headers.name'),
        t('dashboard.csv_headers.total_tasks'),
        t('dashboard.csv_headers.completed'),
        t('dashboard.csv_headers.completion_rate'),
        t('dashboard.csv_headers.quality'),
        t('dashboard.csv_headers.discipline'),
        t('dashboard.csv_headers.active_tasks'),
        t('dashboard.csv_headers.in_progress_h'),
        t('dashboard.csv_headers.on_review_h'),
        t('dashboard.csv_headers.revision_h')
      ];
      rows.push(headers.map(escapeCSV).join(';'));

      empsToExport.forEach((emp) => {
        const activeCount =
          (emp.statuses?.created || 0) +
          (emp.statuses?.in_progress || 0) +
          (emp.statuses?.revision || 0);
        const row = [
          emp.name,
          emp.total,
          emp.completed,
          emp.completion_rate,
          emp.quality,
          emp.discipline ?? 100,
          activeCount,
          emp.cycle_time?.in_progress || 0,
          emp.cycle_time?.on_review || 0,
          emp.cycle_time?.revision || 0
        ];
        rows.push(row.map(escapeCSV).join(';'));
      });
      filename = `analytics_employees_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const renderProductivityChart = () => {
    if (!analytics) return null;

    if (chartTarget === 'all_depts') {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={analytics.departments} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} domain={[0, 100]} />
            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8b5cf6' }} domain={[0, 5]} />
            <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
            <Bar yAxisId="left" dataKey="completion_rate" name={t('dashboard.charts.completed_on_time')} fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={50} />
            <Line yAxisId="right" type="monotone" dataKey="quality" name={t('dashboard.charts.average_quality')} stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    if (chartTarget === 'all_emps' || chartTarget === 'all_emps_in_dept') {
      let dataToRender = analytics.employees;
      if (analytics.scope === 'institute' && selectedId && chartTarget === 'all_emps_in_dept') {
        dataToRender = analytics.employees.filter((e) => e.department_id === parseInt(selectedId));
      }
      return (
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={dataToRender} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} interval={0} angle={-30} textAnchor="end" height={60} />
            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} domain={[0, 100]} />
            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8b5cf6' }} domain={[0, 5]} />
            <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            <Bar yAxisId="left" dataKey="completion_rate" name={t('dashboard.charts.task_completion')} fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
            <Line yAxisId="right" type="monotone" dataKey="quality" name={t('dashboard.charts.quality')} stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    if (chartTarget === 'bottlenecks_emps' || chartTarget === 'bottlenecks_depts') {
      const isDept = chartTarget === 'bottlenecks_depts';
      const sourceData = isDept ? analytics.departments : analytics.employees;
      const chartData = sourceData.map((item) => ({
        name: item.name,
        in_progress: item.cycle_time?.in_progress || 0,
        on_review: item.cycle_time?.on_review || 0,
        revision: item.cycle_time?.revision || 0
      }));
      return (
        <div className="flex flex-col h-full">
          <div className="mb-4 text-center">
            <h4 className="font-bold text-gray-700 text-sm">{t('dashboard.charts.where_stuck')}</h4>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} interval={0} angle={isDept ? 0 : -30} textAnchor={isDept ? 'middle' : 'end'} height={60} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
              <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="in_progress" name={t('dashboard.charts.in_progress_hours')} stackId="a" fill="#3b82f6" maxBarSize={40} />
              <Bar dataKey="on_review" name={t('dashboard.charts.on_review_hours')} stackId="a" fill="#f59e0b" maxBarSize={40} />
              <Bar dataKey="revision" name={t('dashboard.charts.revision_hours')} stackId="a" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartTarget === 'burnout') {
      const burnoutData = analytics.employees
        .map((emp) => {
          const active = emp.statuses.created + emp.statuses.in_progress + emp.statuses.revision;
          return { ...emp, active_tasks: active };
        })
        .sort((a, b) => b.active_tasks - a.active_tasks);

      const calcAvg = burnoutData.length ? burnoutData.reduce((s, e) => s + e.active_tasks, 0) / burnoutData.length : 0;
      const avgActive = Math.max(calcAvg, 3);

      return (
        <div className="flex flex-col h-full">
          <div className="mb-4 text-center">
            <h4 className="font-bold text-red-700 text-sm">{t('dashboard.charts.burnout_risk')}</h4>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={burnoutData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis axisLine={false} tickLine={false} />
              <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px' }} />
              <ReferenceLine y={avgActive} stroke="#f59e0b" strokeDasharray="3 3" />
              <Bar dataKey="active_tasks" name={t('dashboard.charts.active_tasks')} radius={[6, 6, 0, 0]} maxBarSize={40}>
                {burnoutData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.active_tasks >= avgActive * 1.5 ? '#ef4444' : entry.active_tasks > avgActive ? '#f59e0b' : '#10b981'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartTarget === 'revisions') {
      const filteredEmps = analytics.employees.filter((e) => e.revisions.total_evaluated > 0);
      return (
        <div className="flex flex-col h-full">
          <div className="mb-4 text-center">
            <h4 className="font-bold text-indigo-700 text-sm">{t('dashboard.charts.revisions_freq')}</h4>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={filteredEmps} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" axisLine={false} tickLine={false} hide />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#555', fontWeight: 'bold' }} width={95} />
              <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="revisions.zero_revisions" name={t('dashboard.charts.first_try')} stackId="a" fill="#10b981" />
              <Bar dataKey="revisions.one_revision" name={t('dashboard.charts.one_revision')} stackId="a" fill="#f59e0b" />
              <Bar dataKey="revisions.multiple_revisions" name={t('dashboard.charts.multiple_revisions')} stackId="a" fill="#ef4444" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartTarget === 'single') {
      let entity = analytics.employees.find((e) => e.id === parseInt(selectedId));
      if (!entity) return <div className="text-center text-gray-400 py-16">{t('dashboard.charts.select_employee_prompt')}</div>;

      const funnelData = [
        { name: t('dashboard.charts.funnel.created'), value: entity.statuses.created, fill: '#9ca3af' },
        { name: t('dashboard.charts.funnel.in_progress'), value: entity.statuses.in_progress, fill: '#3b82f6' },
        { name: t('dashboard.charts.funnel.revision'), value: entity.statuses.revision, fill: '#ef4444' },
        { name: t('dashboard.charts.funnel.on_review'), value: entity.statuses.on_review, fill: '#f59e0b' },
        { name: t('dashboard.charts.funnel.completed'), value: entity.statuses.completed, fill: '#10b981' }
      ];

      const radarData = [
        { subject: t('dashboard.charts.radar.quality'), A: entity.radar?.quality || 0, fullMark: 100 },
        { subject: t('dashboard.charts.radar.discipline'), A: entity.radar?.discipline || 0, fullMark: 100 },
        { subject: t('dashboard.charts.radar.autonomy'), A: entity.radar?.autonomy || 0, fullMark: 100 },
        { subject: t('dashboard.charts.radar.speed'), A: entity.radar?.speed || 0, fullMark: 100 },
        { subject: t('dashboard.charts.radar.volume'), A: entity.radar?.volume || 0, fullMark: 100 }
      ];

      const revisionData = [
        { name: t('dashboard.charts.first_try'), value: entity.revisions?.zero_revisions || 0, fill: '#10b981' },
        { name: t('dashboard.charts.one_revision'), value: entity.revisions?.one_revision || 0, fill: '#f59e0b' },
        { name: t('dashboard.charts.multiple_revisions'), value: entity.revisions?.multiple_revisions || 0, fill: '#ef4444' }
      ].filter((d) => d.value > 0);

      return (
        <div className="flex flex-col h-full">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100">
            <div>
              <h4 className="font-extrabold text-blue-950 text-lg">{entity.name}</h4>
              <p className="text-xs font-medium text-blue-700 mt-0.5">{t('dashboard.charts.detailed_profile')}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-white text-emerald-700 border border-emerald-200 px-3 py-1 rounded-xl text-xs font-bold shadow-sm">
                {entity.completion_rate}%
              </span>
              <span className="bg-blue-600 text-white px-3 py-1 rounded-xl text-xs font-bold shadow-sm">
                ★ {entity.quality} / 5.0
              </span>
              <Link
                to={`/profile/${entity.id}`}
                className="bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1 rounded-xl text-xs font-bold transition"
              >
                &rarr;
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-[280px]">
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col justify-center">
              <h5 className="text-xs font-bold text-gray-400 uppercase text-center mb-2">{t('dashboard.charts.task_funnel')}</h5>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={80} />
                  <ChartTooltip cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={15} label={{ position: 'right', fill: '#888' }} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col justify-center items-center">
              <h5 className="text-xs font-bold text-gray-400 uppercase text-center mb-2">{t('dashboard.charts.revisions_freq')}</h5>
              {revisionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={revisionData} innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {revisionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">{t('dashboard.charts.no_data')}</div>
              )}
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-4 shadow-sm flex flex-col justify-center">
              <h5 className="text-xs font-bold text-indigo-500 uppercase text-center mb-2">{t('dashboard.charts.radar.title')}</h5>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#c7d2fe" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#4f46e5', fontSize: 10, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="A" stroke="#4f46e5" strokeWidth={2} fill="#6366f1" fillOpacity={0.5} />
                  <ChartTooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6">
      {/* 1. ПРЕДСТАВИТЕЛЬСКИЙ ВЕРХНИЙ БАННЕР */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-3xl shadow-lg p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:18px_18px]"></div>

        <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <Link
              to="/profile"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-white/30 shadow-md overflow-hidden bg-white/10 backdrop-blur flex items-center justify-center text-2xl font-black shrink-0 hover:scale-105 transition"
            >
              {savedAvatar ? (
                <img src={savedAvatar} alt={currentUser.last_name} className="w-full h-full object-cover" />
              ) : (
                <span>
                  {currentUser.last_name ? currentUser.last_name[0] : ''}
                  {currentUser.first_name ? currentUser.first_name[0] : currentUser.username[0]}
                </span>
              )}
            </Link>

            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-blue-200 mb-1">
                <span>
                  {todayObj.toLocaleDateString(dateLocale, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
                {currentUser.department_name && (
                  <>
                    <span>•</span>
                    <span className="bg-white/10 px-2.5 py-0.5 rounded-full text-white">{currentUser.department_name}</span>
                  </>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {t('dashboard.welcome')}, {currentUser.first_name || currentUser.username}!
              </h1>

              <p className="text-blue-200 text-sm mt-1">
                {analytics?.scope === 'institute'
                  ? t('dashboard.panel_institute')
                  : analytics?.scope === 'department'
                  ? t('dashboard.panel_department')
                  : t('dashboard.panel_teacher')}
              </p>
            </div>
          </div>

          {/* Быстрые кнопки в шапке */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
            {!isCheckedInToday ? (
              <button
                type="button"
                onClick={handleQuickCheckIn}
                disabled={checkingIn}
                className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-gray-900 px-4 py-2.5 rounded-xl text-xs font-extrabold transition shadow-md"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t('profile.check_in_btn')}</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-emerald-300 px-3.5 py-2.5 rounded-xl text-xs font-bold backdrop-blur-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{t('profile.checked_in_today')}</span>
              </div>
            )}

            <Link
              to="/tasks"
              className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition backdrop-blur-sm"
            >
              <span>{t('dashboard.open_tasks_btn')}</span>
            </Link>

            <button
              onClick={handleExportAnalyticsCSV}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-md shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{t('dashboard.export_csv')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. КАРТОЧКИ КЛЮЧЕВЫХ ПОКАЗАТЕЛЕЙ (KPI) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Выполнение в срок */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('dashboard.completion_rate')}</p>
              <p className="text-3xl font-black text-gray-900 mt-2">{analytics?.kpi.completion_rate ?? 0}%</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${analytics?.kpi.completion_rate ?? 0}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400 mt-2">{t('dashboard.completion_subtitle')}</p>
          </div>
        </div>

        {/* KPI 2: Среднее качество работ */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('dashboard.your_quality')}</p>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-3xl font-black text-blue-600">{analytics?.kpi.avg_quality ?? 0}</span>
                <span className="text-sm font-bold text-gray-400">/ 5.0</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 text-xl font-black">
              ★
            </div>
          </div>
          <div className="mt-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <div
                  key={star}
                  className={`h-1.5 flex-1 rounded-full ${
                    (analytics?.kpi.avg_quality || 0) >= star ? 'bg-blue-600' : 'bg-gray-100'
                  }`}
                ></div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">{t('dashboard.quality_subtitle')}</p>
          </div>
        </div>

        {/* KPI 3 и 4: Зависят от роли (Руководство или Преподаватель) */}
        {isAdmin ? (
          <>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('dashboard.staff_online')}</p>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-3xl font-black text-purple-600">{analytics?.kpi.on_time ?? 0}</span>
                    <span className="text-sm font-bold text-gray-400">/ {analytics?.kpi.total_staff ?? 0}</span>
                  </div>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">{t('dashboard.staff_subtitle')}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('dashboard.lates_today')}</p>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-3xl font-black text-amber-500">{analytics?.kpi.late ?? 0}</span>
                    <span className="text-sm font-bold text-gray-400">{t('dashboard.people')}</span>
                  </div>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">{t('dashboard.lates_subtitle')}</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('dashboard.my_active_kpi')}</p>
                  <p className="text-3xl font-black text-indigo-600 mt-2">{myActiveTasks.length}</p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">{t('dashboard.my_active_subtitle')}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('profile.tabs.schedule')}</p>
                  <p className="text-3xl font-black text-purple-600 mt-2">{todayClasses.length}</p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">{t('dashboard.widgets.today_schedule_title')}</p>
            </div>
          </>
        )}
      </div>

      {/* 3. ЦЕНТР ПРОДУКТИВНОСТИ И АНАЛИТИЧЕСКИЕ ГРАФИКИ */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-6 rounded-full bg-blue-600"></div>
            <h3 className="font-extrabold text-gray-800 text-lg">
              {isAdmin ? t('dashboard.productivity_center') : t('dashboard.personal_productivity')}
            </h3>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              {analytics?.scope === 'institute' && (
                <>
                  <button
                    onClick={() => {
                      setChartTarget('all_depts');
                      setSelectedId('');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      chartTarget === 'all_depts' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t('dashboard.filters.departments')}
                  </button>
                  <button
                    onClick={() => {
                      setChartTarget('bottlenecks_depts');
                      setSelectedId('');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      chartTarget === 'bottlenecks_depts'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    {t('dashboard.filters.delays_dept')}
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setChartTarget('all_emps');
                  setSelectedId('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  chartTarget === 'all_emps' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t('dashboard.filters.employees')}
              </button>
              <button
                onClick={() => {
                  setChartTarget('bottlenecks_emps');
                  setSelectedId('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  chartTarget === 'bottlenecks_emps'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                {t('dashboard.filters.delays_emp')}
              </button>
              <button
                onClick={() => {
                  setChartTarget('revisions');
                  setSelectedId('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  chartTarget === 'revisions'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                {t('dashboard.filters.revisions')}
              </button>
              <button
                onClick={() => {
                  setChartTarget('burnout');
                  setSelectedId('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  chartTarget === 'burnout' ? 'bg-red-600 text-white shadow-sm' : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                {t('dashboard.filters.burnout')}
              </button>

              {analytics?.scope === 'institute' && (
                <select
                  className="px-3 py-1.5 rounded-xl text-xs font-bold outline-none cursor-pointer border bg-gray-50 border-gray-200 text-gray-700"
                  value={chartTarget === 'all_emps_in_dept' ? selectedId : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedId(e.target.value);
                      setChartTarget('all_emps_in_dept');
                    } else {
                      setChartTarget('all_depts');
                      setSelectedId('');
                    }
                  }}
                >
                  <option value="">{t('dashboard.filters.select_dept')}</option>
                  {analytics.departments.map((d) => (
                    <option key={`dept-${d.id}`} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}

              <select
                className="px-3 py-1.5 rounded-xl text-xs font-bold outline-none cursor-pointer border bg-gray-50 border-gray-200 text-gray-700"
                value={chartTarget === 'single' ? selectedId : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedId(e.target.value);
                    setChartTarget('single');
                  }
                }}
              >
                <option value="">{t('dashboard.filters.select_emp')}</option>
                {analytics?.employees.map((e) => (
                  <option key={`emp-${e.id}`} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="w-full">{renderProductivityChart()}</div>
      </div>

      {/* 4. НИЖНЯЯ ОПЕРАТИВНАЯ ПАНЕЛЬ (2 КОЛОНКИ: ПРИОРИТЕТНЫЕ ЗАДАЧИ И РЕЙТИНГ / РАСПИСАНИЕ) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ЛЕВАЯ КОЛОНКА (2/3): ТРЕБУЮТ ВНИМАНИЯ / МОИ ПРИОРИТЕТНЫЕ ЗАДАЧИ */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
          <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <h3 className="font-bold text-gray-800 text-base">
                {isAdmin ? t('dashboard.widgets.attention_title_admin') : t('dashboard.widgets.attention_title_teacher')}
              </h3>
            </div>
            <Link to="/tasks" className="text-xs font-bold text-blue-600 hover:underline">
              {t('dashboard.widgets.view_all')} &rarr;
            </Link>
          </div>

          {priorityList.length > 0 ? (
            <div className="space-y-3">
              {priorityList.map((task) => {
                const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';
                return (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    className={`p-4 rounded-xl border transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                      task.status === 'on_review'
                        ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                        : isOverdue
                        ? 'bg-red-50/40 border-red-200 hover:border-red-300'
                        : 'bg-gray-50/50 border-gray-100 hover:bg-white hover:border-blue-200 hover:shadow-sm'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            task.status === 'on_review'
                              ? 'bg-amber-100 text-amber-800'
                              : task.status === 'revision'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {t(`tasks.status.${task.status}`)}
                        </span>
                        {isOverdue && (
                          <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                            {t('task_detail.overdue')}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-blue-600 transition-colors truncate">
                        {task.title}
                      </h4>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{task.description}</p>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                      <span className={`text-xs font-bold ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                        {new Date(task.deadline).toLocaleDateString(dateLocale, {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                      <div className="flex -space-x-1.5">
                        {task.assignees?.slice(0, 3).map((a, idx) => (
                          <div
                            key={idx}
                            className="w-6 h-6 rounded-full bg-blue-600 border-2 border-white text-white flex items-center justify-center text-[10px] font-bold"
                            title={`${a.last_name} ${a.first_name}`}
                          >
                            {a.last_name ? a.last_name[0] : 'U'}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-gray-400 text-sm py-12 border-2 border-dashed border-gray-100 rounded-2xl">
              {t('dashboard.widgets.attention_empty')}
            </div>
          )}
        </div>

        {/* ПРАВАЯ КОЛОНКА (1/3): РАСПИСАНИЕ НА СЕГОДНЯ ИЛИ ЛИДЕРЫ ПРОДУКТИВНОСТИ */}
        <div className="space-y-6">
          {/* Блок: Лидеры продуктивности (для руководства) */}
          {isAdmin && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
                <h3 className="font-bold text-gray-800 text-base">{t('dashboard.widgets.leaderboard_title')}</h3>
              </div>

              {topEmployees.length > 0 ? (
                <div className="space-y-3">
                  {topEmployees.map((emp, idx) => (
                    <Link
                      key={emp.id}
                      to={`/profile/${emp.id}`}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                            idx === 0
                              ? 'bg-amber-100 text-amber-700'
                              : idx === 1
                              ? 'bg-gray-200 text-gray-700'
                              : idx === 2
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="font-bold text-sm text-gray-800 group-hover:text-blue-600 truncate">
                          {emp.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {emp.quality > 0 && (
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                            ★ {emp.quality}
                          </span>
                        )}
                        <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md">
                          {emp.completion_rate}%
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 text-sm py-6">{t('dashboard.widgets.leaderboard_empty')}</p>
              )}
            </div>
          )}

          {/* Блок: Мои пары на сегодня */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
              <h3 className="font-bold text-gray-800 text-base">{t('dashboard.widgets.today_schedule_title')}</h3>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                {todayRuKey ? t(`profile.schedule.days.${todayRuKey}`, { defaultValue: todayRuKey }) : '—'}
              </span>
            </div>

            {jsDayIndex === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">{t('dashboard.widgets.sunday_rest')}</div>
            ) : todayClasses.length > 0 ? (
              <div className="space-y-3">
                {todayClasses.map((cls, idx) => (
                  <div key={cls.id || idx} className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/60 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                        {cls.time}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        {t('profile.schedule.room')} {cls.room}
                      </span>
                    </div>
                    <p className="font-bold text-gray-800 text-sm">{cls.name}</p>
                    <p className="text-xs text-gray-500">
                      {cls.type} • {t('profile.schedule.group')} {cls.group}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400 text-sm py-8 border-2 border-dashed border-gray-100 rounded-xl">
                {t('dashboard.widgets.today_schedule_empty')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}