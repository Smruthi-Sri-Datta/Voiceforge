import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from backend.main import app

client = TestClient(app)

# ══════════════════════════════════════════════════════════
# UNIT TESTS — language detection logic
# ══════════════════════════════════════════════════════════

class TestLanguageDetection:
    """Test language mismatch detection in tts_service"""

    def test_english_text_with_english_selected(self):
        """English text + English language = no error"""
        with patch("backend.services.tts_service.tts_service.tts") as mock_tts, \
             patch("backend.services.tts_service.detect", return_value="en"), \
             patch("backend.services.tts_service.subprocess.run"), \
             patch("builtins.open", MagicMock()), \
             patch("os.remove"):
            mock_tts.tts_to_file.return_value = None
            from backend.services.tts_service import tts_service
            try:
                tts_service.generate_audio(
                    text="Hello world",
                    output_path="/tmp/test.wav",
                    language="en"
                )
            except ValueError:
                pytest.fail("Should not raise ValueError for matching language")

    def test_english_text_with_french_selected(self):
        """English text + French selected = hard error"""
        with patch("backend.services.tts_service.detect", return_value="en"):
            from backend.services.tts_service import tts_service
            with pytest.raises(ValueError) as exc:
                tts_service.generate_audio(
                    text="Hello world",
                    output_path="/tmp/test.wav",
                    language="fr"
                )
            assert "French" in str(exc.value)

    def test_romanized_hindi_warning(self):
        """Romanized Hindi (Latin script) + Hindi selected = warning, not error"""
        with patch("backend.services.tts_service.detect", return_value="so"), \
             patch("backend.services.tts_service.tts_service.tts") as mock_tts, \
             patch("backend.services.tts_service.requests.post") as mock_post, \
             patch("backend.services.tts_service.subprocess.run"), \
             patch("builtins.open", MagicMock()), \
             patch("os.remove"), \
             patch("base64.b64decode", return_value=b"fakeaudio"):
            mock_tts.tts_to_file.return_value = None
            mock_response = MagicMock()
            mock_response.ok = True
            mock_response.json.return_value = {"audios": ["ZmFrZWF1ZGlv"]}
            mock_post.return_value = mock_response
            from backend.services.tts_service import tts_service
            result = tts_service.generate_audio(
                text="Zindagi ne is kaddar kiya hai",
                output_path="/tmp/test.wav",
                language="hi"
            )
            assert result is not None
            assert "Roman" in result

    def test_english_text_with_kannada_selected(self):
        """English text + Kannada selected = hard error (no Romanized exception for Kannada)"""
        with patch("backend.services.tts_service.detect", return_value="en"):
            from backend.services.tts_service import tts_service
            with pytest.raises(ValueError) as exc:
                tts_service.generate_audio(
                    text="Hello world",
                    output_path="/tmp/test.wav",
                    language="kn"
                )
            assert "Kannada" in str(exc.value)

    def test_xtts_character_limit(self):
        """Text over 5000 characters for XTTS languages should be rejected"""
        long_text = "A" * 5001
        response = client.post("/api/generate", json={
            "text": long_text,
            "language": "en",
            "speaker": "Ana Florence"
        })
        assert response.status_code in [400, 422]

    def test_sarvam_character_limit(self):
        """Text over 2500 characters for Indian languages should be rejected"""
        long_text = "A" * 2501
        with patch("backend.services.tts_service.detect", return_value="hi"):
            response = client.post("/api/generate", json={
                "text": long_text,
                "language": "hi",
                "speaker": "Anushka"
            })
        assert response.status_code in [400, 422]


# ══════════════════════════════════════════════════════════
# UNIT TESTS — engine routing
# ══════════════════════════════════════════════════════════

class TestEngineRouting:
    """Test that the correct TTS engine is selected per language"""

    def test_english_routes_to_xtts(self):
        """English should use XTTS, not Sarvam"""
        with patch("backend.services.tts_service.tts_service._generate_xtts") as mock_xtts, \
             patch("backend.services.tts_service.tts_service._generate_sarvam") as mock_sarvam:
            mock_xtts.return_value = None
            from backend.services.tts_service import tts_service
            tts_service.generate_audio(text="Hello", output_path="/tmp/test.wav", language="en")
            mock_xtts.assert_called_once()
            mock_sarvam.assert_not_called()

    def test_hindi_routes_to_sarvam(self):
        """Hindi should use Sarvam, not XTTS"""
        with patch("backend.services.tts_service.tts_service._generate_xtts") as mock_xtts, \
             patch("backend.services.tts_service.tts_service._generate_sarvam") as mock_sarvam:
            mock_sarvam.return_value = None
            from backend.services.tts_service import tts_service
            tts_service.generate_audio(text="नमस्ते", output_path="/tmp/test.wav", language="hi")
            mock_sarvam.assert_called_once()
            mock_xtts.assert_not_called()

    def test_tamil_routes_to_sarvam(self):
        """Tamil should use Sarvam, not XTTS"""
        with patch("backend.services.tts_service.tts_service._generate_xtts") as mock_xtts, \
             patch("backend.services.tts_service.tts_service._generate_sarvam") as mock_sarvam:
            mock_sarvam.return_value = None
            from backend.services.tts_service import tts_service
            tts_service.generate_audio(text="வணக்கம்", output_path="/tmp/test.wav", language="ta")
            mock_sarvam.assert_called_once()
            mock_xtts.assert_not_called()


# ══════════════════════════════════════════════════════════
# INTEGRATION TESTS — TTS endpoints
# ══════════════════════════════════════════════════════════

class TestGenerateEndpoint:
    """Test POST /api/generate"""

    def test_generate_success(self):
        """Valid request should return 200 with file and warning fields"""
        with patch("backend.routes.tts.tts_service.generate_audio", return_value=None):
            response = client.post("/api/generate", json={
                "text": "Hello, this is a test.",
                "language": "en",
                "speaker": "Ana Florence",
                "speed": 1.0
            })
            assert response.status_code == 200
            assert "file" in response.json()
            assert "warning" in response.json()
            assert response.json()["warning"] is None

    def test_generate_returns_mp3(self):
        """Generated file should have .mp3 extension"""
        with patch("backend.routes.tts.tts_service.generate_audio", return_value=None):
            response = client.post("/api/generate", json={
                "text": "Hello world",
                "language": "en",
                "speaker": "Ana Florence",
                "speed": 1.0
            })
            assert response.status_code == 200
            assert response.json()["file"].endswith(".mp3")

    def test_generate_with_warning(self):
        """Romanized Hindi should return 200 with warning message"""
        warning_msg = "Your text appears to be in Roman/Latin script."
        with patch("backend.routes.tts.tts_service.generate_audio", return_value=warning_msg):
            response = client.post("/api/generate", json={
                "text": "Zindagi ne is kaddar kiya hai",
                "language": "hi",
                "speaker": "Anushka",
                "speed": 1.0
            })
            assert response.status_code == 200
            assert response.json()["warning"] == warning_msg

    def test_generate_language_mismatch(self):
        """Wrong language should return 422"""
        with patch("backend.routes.tts.tts_service.generate_audio",
                   side_effect=ValueError("Text appears to be English but you selected French.")):
            response = client.post("/api/generate", json={
                "text": "Hello world",
                "language": "fr",
                "speaker": "Ana Florence",
                "speed": 1.0
            })
            assert response.status_code == 422
            assert "French" in response.json()["detail"]

    def test_generate_kannada_latin_mismatch(self):
        """English text + Kannada should return 422"""
        with patch("backend.routes.tts.tts_service.generate_audio",
                   side_effect=ValueError("Text appears to be in Latin script but you selected Kannada.")):
            response = client.post("/api/generate", json={
                "text": "Hello world",
                "language": "kn",
                "speaker": "Anushka",
                "speed": 1.0
            })
            assert response.status_code == 422
            assert "Kannada" in response.json()["detail"]

    def test_generate_empty_text(self):
        """Empty text should be rejected"""
        response = client.post("/api/generate", json={
            "text": "",
            "language": "en",
            "speaker": "Ana Florence"
        })
        assert response.status_code in [400, 422]

    def test_generate_missing_text_field(self):
        """Missing text field should return 422 (Pydantic validation)"""
        response = client.post("/api/generate", json={
            "language": "en",
            "speaker": "Ana Florence"
        })
        assert response.status_code == 422


class TestVoicesEndpoint:
    """Test GET /api/voices"""

    def test_get_voices_returns_list(self):
        """Should return list of available voices"""
        response = client.get("/api/voices")
        assert response.status_code == 200
        assert "voices" in response.json()
        assert len(response.json()["voices"]) > 0

    def test_voices_contain_ana_florence(self):
        """Ana Florence should always be in the voices list"""
        response = client.get("/api/voices")
        assert "Ana Florence" in response.json()["voices"]


class TestLanguagesEndpoint:
    """Test GET /api/languages"""

    def test_get_languages_returns_list(self):
        """Should return list of supported languages"""
        response = client.get("/api/languages")
        assert response.status_code == 200
        assert "languages" in response.json()
        assert len(response.json()["languages"]) > 0

    def test_languages_contain_english(self):
        """English should always be in the languages list"""
        response = client.get("/api/languages")
        codes = [l["code"] for l in response.json()["languages"]]
        assert "en" in codes

    def test_all_16_languages_present(self):
        """All 16 supported languages should be present"""
        response = client.get("/api/languages")
        codes = [l["code"] for l in response.json()["languages"]]
        expected = ["en", "fr", "de", "es", "ja", "zh-cn",   # XTTS
                    "hi", "bn", "ta", "te", "gu", "kn",       # Sarvam
                    "ml", "mr", "pa", "or"]                    # Sarvam
        for code in expected:
            assert code in codes, f"Missing language: {code}"

    def test_languages_have_engine_field(self):
        """Each language should specify which engine it uses"""
        response = client.get("/api/languages")
        for lang in response.json()["languages"]:
            assert "engine" in lang, f"Missing engine field for {lang['code']}"
            assert lang["engine"] in ["xtts", "sarvam"]

    def test_indian_languages_use_sarvam(self):
        """All Indian languages should be marked as sarvam engine"""
        response = client.get("/api/languages")
        indian = ["hi", "bn", "ta", "te", "gu", "kn", "ml", "mr", "pa", "or"]
        lang_map = {l["code"]: l["engine"] for l in response.json()["languages"]}
        for code in indian:
            assert lang_map[code] == "sarvam", f"{code} should use sarvam engine"

    def test_global_languages_use_xtts(self):
        """All global languages should be marked as xtts engine"""
        response = client.get("/api/languages")
        global_langs = ["en", "fr", "de", "es", "ja", "zh-cn"]
        lang_map = {l["code"]: l["engine"] for l in response.json()["languages"]}
        for code in global_langs:
            assert lang_map[code] == "xtts", f"{code} should use xtts engine"