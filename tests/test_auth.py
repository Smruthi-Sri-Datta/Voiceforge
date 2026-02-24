import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from backend.main import app
from backend.database import get_db

client = TestClient(app)

# ══════════════════════════════════════════════════════════
# UNIT TESTS — isolated logic, no database needed
# ══════════════════════════════════════════════════════════

class TestPasswordValidation:
    """Test password strength rules enforced in /api/auth/register"""

    def test_password_too_short(self):
        response = client.post("/api/auth/register", json={
            "name": "Test User", "email": "test@example.com", "password": "Ab1!"
        })
        assert response.status_code == 400
        assert "8 characters" in response.json()["detail"]

    def test_password_no_uppercase(self):
        response = client.post("/api/auth/register", json={
            "name": "Test User", "email": "test@example.com", "password": "abcdef1!"
        })
        assert response.status_code == 400
        assert "uppercase" in response.json()["detail"]

    def test_password_no_lowercase(self):
        response = client.post("/api/auth/register", json={
            "name": "Test User", "email": "test@example.com", "password": "ABCDEF1!"
        })
        assert response.status_code == 400
        assert "lowercase" in response.json()["detail"]

    def test_password_no_number(self):
        response = client.post("/api/auth/register", json={
            "name": "Test User", "email": "test@example.com", "password": "Abcdefg!"
        })
        assert response.status_code == 400
        assert "number" in response.json()["detail"]

    def test_password_no_special_char(self):
        response = client.post("/api/auth/register", json={
            "name": "Test User", "email": "test@example.com", "password": "Abcdef12"
        })
        assert response.status_code == 400
        assert "special character" in response.json()["detail"]


class TestJWT:
    """Test JWT token creation and decoding"""

    def test_jwt_created_on_login(self):
        """Valid login should return a JWT token"""
        with patch("backend.routes.auth.pwd_ctx.verify", return_value=True):
            mock_user = MagicMock()
            mock_user.id            = "test-id"
            mock_user.email         = "test@example.com"
            mock_user.name          = "Test User"
            mock_user.picture       = None
            mock_user.is_verified   = True
            mock_user.auth_provider = "email"
            mock_user.password_hash = "hashed"

            with patch("backend.routes.auth.Session") as mock_session:
                mock_db = MagicMock()
                mock_db.query().filter().first.return_value = mock_user
                mock_session.return_value.__enter__.return_value = mock_db

                from backend.routes.auth import create_jwt
                token = create_jwt(mock_user)
                assert token is not None
                assert isinstance(token, str)
                assert len(token) > 0

    def test_jwt_decode(self):
        """Token created should be decodable and contain correct fields"""
        mock_user = MagicMock()
        mock_user.id      = "user-123"
        mock_user.email   = "test@example.com"
        mock_user.name    = "Test User"
        mock_user.picture = None

        from backend.routes.auth import create_jwt, decode_jwt
        token   = create_jwt(mock_user)
        payload = decode_jwt(token)

        assert payload["sub"]   == "user-123"
        assert payload["email"] == "test@example.com"
        assert payload["name"]  == "Test User"


class TestOTPGeneration:
    """Test OTP generation logic"""

    def test_otp_is_6_digits(self):
        from backend.routes.auth import generate_otp
        otp = generate_otp()
        assert len(otp) == 6
        assert otp.isdigit()

    def test_otp_is_random(self):
        from backend.routes.auth import generate_otp
        otps = {generate_otp() for _ in range(10)}
        assert len(otps) > 1


# ══════════════════════════════════════════════════════════
# INTEGRATION TESTS — real endpoints, mocked database
# ══════════════════════════════════════════════════════════

class TestRegisterEndpoint:
    """Test POST /api/auth/register"""

    def test_register_success(self):
        """Valid registration should return 200 and requires_otp"""
        mock_db = MagicMock()
        mock_db.query().filter().first.return_value = None  # no existing user
        app.dependency_overrides[get_db] = lambda: mock_db

        with patch("backend.routes.auth.send_otp_email") as mock_email:
            response = client.post("/api/auth/register", json={
                "name": "Test User",
                "email": "newuser@example.com",
                "password": "StrongPass1!"
            })

        app.dependency_overrides.clear()
        assert response.status_code == 200
        assert response.json()["requires_otp"] == True
        mock_email.assert_called_once()

    def test_register_duplicate_verified_email(self):
        """Registering with an already verified email should return 400"""
        mock_db  = MagicMock()
        existing = MagicMock()
        existing.is_verified   = True
        existing.auth_provider = "email"
        mock_db.query().filter().first.return_value = existing
        app.dependency_overrides[get_db] = lambda: mock_db

        response = client.post("/api/auth/register", json={
            "name": "Test User",
            "email": "existing@example.com",
            "password": "StrongPass1!"
        })

        app.dependency_overrides.clear()
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_register_google_email(self):
        """Registering with a Google-linked email should return 400"""
        mock_db  = MagicMock()
        existing = MagicMock()
        existing.auth_provider = "google"
        mock_db.query().filter().first.return_value = existing
        app.dependency_overrides[get_db] = lambda: mock_db

        response = client.post("/api/auth/register", json={
            "name": "Test User",
            "email": "google@example.com",
            "password": "StrongPass1!"
        })

        app.dependency_overrides.clear()
        assert response.status_code == 400
        assert "Google" in response.json()["detail"]


class TestLoginEndpoint:
    """Test POST /api/auth/login"""

    def test_login_wrong_password(self):
        """Wrong password should return 401"""
        mock_db   = MagicMock()
        mock_user = MagicMock()
        mock_user.auth_provider  = "email"
        mock_user.password_hash  = "hashed"
        mock_user.is_verified    = True
        mock_db.query().filter().first.return_value = mock_user
        app.dependency_overrides[get_db] = lambda: mock_db

        with patch("backend.routes.auth.pwd_ctx.verify", return_value=False):
            response = client.post("/api/auth/login", json={
                "email": "test@example.com",
                "password": "WrongPass1!"
            })

        app.dependency_overrides.clear()
        assert response.status_code == 401
        assert "Incorrect password" in response.json()["detail"]

    def test_login_unverified_user(self):
        """Unverified user login should return 403 and trigger new OTP"""
        mock_db   = MagicMock()
        mock_user = MagicMock()
        mock_user.auth_provider  = "email"
        mock_user.password_hash  = "hashed"
        mock_user.is_verified    = False
        mock_user.name           = "Test User"
        mock_db.query().filter().first.return_value = mock_user
        app.dependency_overrides[get_db] = lambda: mock_db

        with patch("backend.routes.auth.pwd_ctx.verify", return_value=True), \
             patch("backend.routes.auth.send_otp_email") as mock_email:
            response = client.post("/api/auth/login", json={
                "email": "test@example.com",
                "password": "StrongPass1!"
            })

        app.dependency_overrides.clear()
        assert response.status_code == 403
        mock_email.assert_called_once()

    def test_login_no_account(self):
        """Login with non-existent email should return 401"""
        mock_db = MagicMock()
        mock_db.query().filter().first.return_value = None
        app.dependency_overrides[get_db] = lambda: mock_db

        response = client.post("/api/auth/login", json={
            "email": "nobody@example.com",
            "password": "StrongPass1!"
        })

        app.dependency_overrides.clear()
        assert response.status_code == 401
        assert "No account" in response.json()["detail"]