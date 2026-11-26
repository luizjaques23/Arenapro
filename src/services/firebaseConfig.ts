export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/**
 * Configuração do Firebase Realtime Database.
 * Substitua "COLE_AQUI" pelos dados reais do seu projeto no console do Firebase
 * (ou defina as variáveis VITE_FIREBASE_* no arquivo .env).
 */
export const firebaseConfig: FirebaseConfig = {
  apiKey: (import.meta.env?.VITE_FIREBASE_API_KEY as string | undefined) || 'COLE_AQUI',
  authDomain: (import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) || 'COLE_AQUI',
  databaseURL: (import.meta.env?.VITE_FIREBASE_DATABASE_URL as string | undefined) || 'COLE_AQUI',
  projectId: (import.meta.env?.VITE_FIREBASE_PROJECT_ID as string | undefined) || 'COLE_AQUI',
  storageBucket: (import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) || 'COLE_AQUI',
  messagingSenderId:
    (import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) || 'COLE_AQUI',
  appId: (import.meta.env?.VITE_FIREBASE_APP_ID as string | undefined) || 'COLE_AQUI',
};

/**
 * Retorna a URL base limpa do Firebase Realtime Database se estiver configurada,
 * ou null enquanto ainda estiver com o placeholder "COLE_AQUI".
 */
export function getFirebaseDatabaseUrl(): string | null {
  const raw = firebaseConfig.databaseURL?.trim();
  if (!raw || raw === 'COLE_AQUI' || !/^https?:\/\//i.test(raw)) {
    // Caso o usuário tenha preenchido apenas o projectId, monta a URL padrão do RTDB
    const pid = firebaseConfig.projectId?.trim();
    if (pid && pid !== 'COLE_AQUI') {
      return `https://${pid}-default-rtdb.firebaseio.com`;
    }
    return null;
  }
  return raw.replace(/\/+$/, '');
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseDatabaseUrl() !== null;
}
