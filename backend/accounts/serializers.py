from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "phone", "role", "first_name", "last_name")
        read_only_fields = fields


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=32, allow_blank=True, required=False, default="")

    def validate_email(self, value: str) -> str:
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            phone=validated_data.get("phone", ""),
            role=User.Role.EMPLOYEE,
        )
