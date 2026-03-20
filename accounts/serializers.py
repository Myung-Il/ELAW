from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    # 1. 장고가 찾는 username을 '입력 안 해도 됨(required=False)'으로 설정!
    username = serializers.CharField(required=False)

    class Meta:
        model = User
        # 2. fields 목록에 'username' 추가
        fields = [
            'id', 'username', 'email', 'password', 'name', 'role', 'phone',
            'company_name', 'business_number', 'manager_name',
            'ai_consent', 'privacy_consent'
        ]
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        # 3. DB에 저장하기 직전에, 이메일을 username 칸에 똑같이 채워 넣습니다! (핵심 꼼수✨)
        if 'email' in validated_data:
            validated_data['username'] = validated_data['email']

        password = validated_data.pop('password', None)
        user = self.Meta.model(**validated_data)
        if password is not None:
            user.set_password(password)
        user.save()
        return user