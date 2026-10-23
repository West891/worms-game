// Настройки сетевой игры.
//
// Внутри claude.ai игра сама использует комнаты страницы (capability `room`):
// играть могут все, кому открыт доступ к опубликованной игре.
//
// Для публичной версии (GitHub Pages и т. п.) нужен Supabase: создайте проект на
// https://supabase.com, скопируйте Project URL и anon public key из
// Project Settings → API и впишите их сюда. Realtime включён в проектах по умолчанию.
export const NET_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseJs: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
};

// Версия протокола: игроки с разными версиями не попадают друг к другу.
export const PROTOCOL = 1;
