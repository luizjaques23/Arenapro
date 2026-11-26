export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Configuração do banco SQL (Supabase).
 * Cole aqui a URL do seu projeto e a chave anon pública
 * (encontradas em Project Settings -> API no painel do Supabase).
 */
export const supabaseConfig: SupabaseConfig = {
  url: (import.meta.env?.VITE_SUPABASE_URL as string | undefined) || '',
  anonKey: (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined) || '',
};

export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseConfig.url?.trim() &&
    supabaseConfig.anonKey?.trim() &&
    supabaseConfig.url !== 'COLE_AQUI' &&
    supabaseConfig.anonKey !== 'COLE_AQUI'
  );
}
