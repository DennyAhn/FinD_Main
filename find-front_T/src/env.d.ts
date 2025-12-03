/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_VERSION: string
  // 여기에 사용하는 다른 VITE_ 환경 변수들을 필요하면 추가하세요.
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}


