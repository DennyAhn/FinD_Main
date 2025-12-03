"""서비스 계층에서 사용하는 커스텀 예외 정의."""


class ServiceError(Exception):
    """외부 서비스 호출 과정에서 발생한 예외를 표현합니다."""

    def __init__(self, message: str, *, status_code: int = 500) -> None:
        super().__init__(message)
        self.status_code = status_code

