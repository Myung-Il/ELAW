from rest_framework import serializers
from core.models import User

class UserSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        # 2. fields 목록에 'username' 추가
        fields = [
            'id', 'email', 'name', 'password'
        ]
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        # 1. 꼼수 없이 깔끔하게 비밀번호만 따로 빼냅니다.
        password = validated_data.pop('password', None)

        # 2. 남은 데이터(이메일, 이름)로 유저를 만듭니다.
        user = self.Meta.model(**validated_data)

        # 3. 비밀번호는 장고의 안전한 암호화 시스템을 거쳐서 저장합니다.
        if password is not None:
            user.set_password(password)

        user.save()
        return user