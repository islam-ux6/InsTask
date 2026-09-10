from django.db import models

class Department(models.Model):
    name = models.CharField(max_length=255, unique=True, verbose_name='Название кафедры')

    head = models.OneToOneField(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_department',
        verbose_name='Заведующий'
    )

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = 'Кафедра'
        verbose_name_plural = 'Кафедры'