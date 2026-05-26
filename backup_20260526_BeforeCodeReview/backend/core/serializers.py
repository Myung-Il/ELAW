from rest_framework import serializers
from .models import UserGoal

class UserGoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserGoal
        # 사용자가 입력할 핵심 필드들만 모았습니다.
        fields = ['goal_type', 'field', 'job_role', 'start_date', 'end_date', 'duration_weeks']

    def create(self, validated_data):
        # 현재 로그인한 유저를 자동으로 연결해서 저장합니다.
        user = self.context['request'].user
        return UserGoal.objects.create(user=user, **validated_data)