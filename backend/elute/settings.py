"""Environment-backed configuration (BACKEND_PLAN v4.4 §3). Read once at startup from the process environment and
`.env`. No model id, key, or endpoint is hardcoded anywhere else; the key is never logged, echoed, or returned."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

Mode = Literal["fixture", "live"]
DemoTool = Literal["biology", "clinical_trials", "literature", "safety"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str | None = None
    ELUTE_MODE: Mode = "fixture"
    ELUTE_CACHE_DIR: Path = Path(".cache")
    ELUTE_DB_PATH: Path = Path(".cache/elute.sqlite")
    ELUTE_CORS_ORIGINS: str = "http://localhost:5173"
    ELUTE_DEMO_DISABLE_TOOL: DemoTool | None = None
    NCBI_API_KEY: str | None = None
    ELUTE_TODAY: str | None = Field(default=None, description="ISO date override for `as_of` = today; tests pin it")
    ELUTE_DEMO_DIR: Path | None = Field(default=None, description="where completed live runs are written for the browser replay; default <repo>/public/demo (gitignored)")
    ELUTE_LLM_CASSETTES: Path | None = Field(default=None, description="a directory of recorded OpenAI outputs (tests/fixtures/llm) replayed by prompt hash when no key is set")

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.ELUTE_CORS_ORIGINS.split(",") if o.strip()]

    @property
    def demo_dir(self) -> Path:
        return self.ELUTE_DEMO_DIR or Path(__file__).resolve().parents[2] / "public" / "demo"

    @property
    def llm_credentials_present(self) -> bool:
        return bool(self.OPENAI_API_KEY and self.OPENAI_MODEL)

    def redacted(self) -> dict[str, object]:
        """Safe for logs and /health: never the key."""
        return {"mode": self.ELUTE_MODE, "model_set": bool(self.OPENAI_MODEL), "key_set": bool(self.OPENAI_API_KEY),
                "cache_dir": str(self.ELUTE_CACHE_DIR), "db_path": str(self.ELUTE_DB_PATH), "demo_disable_tool": self.ELUTE_DEMO_DISABLE_TOOL,
                "demo_dir": str(self.demo_dir), "llm_cassettes": str(self.ELUTE_LLM_CASSETTES) if self.ELUTE_LLM_CASSETTES else None}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
