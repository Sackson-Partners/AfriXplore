from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://ainuser:localdevpassword@localhost:5433/ain"
    port: int = 3005
    log_level: str = "info"
    cors_origins: str = "http://localhost:3001,http://localhost:3004"
    service_bus_connection_string: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
