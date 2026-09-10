from rest_framework import viewsets
from .models import Department
from .serializers import DepartmentSerializer

class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet для списка кафедр"""
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer