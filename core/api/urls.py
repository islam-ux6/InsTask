from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

# Импортируем наши ViewSet-ы
from accounts.views import UserViewSet
from departments.views import DepartmentViewSet
from tasks.views import TaskViewSet, TaskReportViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'reports', TaskReportViewSet, basename='report')

# router.urls автоматически сгенерирует маршруты типа /api/tasks/, /api/tasks/<id>/ и т.д.
urlpatterns = [
    path('', include(router.urls)),

    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]