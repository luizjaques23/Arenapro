export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Configuração oficial do banco de dados Supabase da ArenaPro.
 * Projeto: hwnlhrpsfyqovuinzjeg
 */
export const supabaseConfig: SupabaseConfig = {
  url: 'https://hwnlhrpsfyqovuinzjeg.supabase.co',
  anonKey: 'sb_publishable_1dcNesTFULRPN9pLV3YvXg_bkak2GXO',
};

export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseConfig.url?.trim() &&
    supabaseConfig.anonKey?.trim() &&
    supabaseConfig.url !== 'COLE_AQUI' &&
    supabaseConfig.anonKey !== 'COLE_AQUI'
  );
}
