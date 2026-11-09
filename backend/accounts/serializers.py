from django.contrib.auth import password_validation
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import PROVINCIAL_ROLES, User


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    province_display = serializers.CharField(source="get_province_display", read_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "role_display",
            "province",
            "province_display",
            "employee_number",
            "phone",
            "is_active",
            "last_login",
            "date_joined",
            "password",
        ]
        read_only_fields = ["last_login", "date_joined"]

    def get_full_name(self, obj: User) -> str:
        return obj.get_full_name() or obj.username

    def validate(self, attrs):
        role = attrs.get("role", getattr(self.instance, "role", None))
        province = attrs.get("province", getattr(self.instance, "province", ""))
        if role in PROVINCIAL_ROLES and not province:
            raise serializers.ValidationError(
                {"province": "A province is required for provincial roles."}
            )
        if not self.instance and not attrs.get("password"):
            raise serializers.ValidationError({"password": "A password is required."})
        if attrs.get("password"):
            password_validation.validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class ProfileSerializer(serializers.ModelSerializer):
    """What the signed-in officer may edit about themselves."""

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "phone"]


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField()

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        password_validation.validate_password(value, self.context["request"].user)
        return value


class OfficerTokenSerializer(TokenObtainPairSerializer):
    """Return the officer profile alongside the token pair."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["province"] = user.province
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data

