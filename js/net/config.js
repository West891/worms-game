// Настройки сетевой игры.
//
// Внутри claude.ai игра сама использует комнаты страницы (capability `room`):
// играть могут все, кому открыт доступ к опубликованной игре.
//
// Для публичной версии (GitHub Pages и т. п.) нужен Supabase: создайте проект на
// https://supabase.com, скопируйте Project URL и anon public key из
// Project Settings → API и впишите их сюда. Realtime включён в проектах по умолчанию.
export const NET_CONFIG = {
  // Публичные ключи: их и так видит любой браузер, секретов здесь нет.
  supabaseUrl: 'https://htdxaiqdjjtqfskmljbp.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZHhhaXFkamp0cWZza21samJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NTMzMzAsImV4cCI6MjA4MTAyOTMzMH0.G0yACdm365pRMw_Pd0QVfOs_c9MdBrGrFTrc2Dtd9to',
  supabaseJs: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
};

// Версия протокола: игроки с разными версиями не попадают друг к другу.
export const PROTOCOL = 2;
