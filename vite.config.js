import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Загружаем .env для доступа к MAL_CLIENT_ID на dev-сервере
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    build: {
      sourcemap: 'hidden',
    },
    define: {
      'import.meta.env.VITE_APP_RELEASE': JSON.stringify(
        process.env.VERCEL_GIT_COMMIT_SHA
          ? `anime-roulette@${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}`
          : 'development'
      ),
      'import.meta.env.VITE_VERCEL_ENV': JSON.stringify(process.env.VERCEL_ENV || ''),
    },
    server: {
      proxy: {
        // ── Shikimori ────────────────────────────────────────────────────
        '/api/shikimori': {
          target: env.VITE_SHIKIMORI_DOMAIN || 'https://shikimori.io',
          changeOrigin: true,
          rewrite: (path) => {
            const url = new URL(path, 'http://localhost');
            const mal_id = url.searchParams.get('mal_id');
            if (mal_id) {
              return `/api/animes?mal_id=${encodeURIComponent(mal_id)}&limit=1`;
            }
            const nickname = url.searchParams.get('nickname') || '';
            const limit    = url.searchParams.get('limit') || '5000';
            const page     = url.searchParams.get('page')  || '1';
            return `/api/users/${encodeURIComponent(nickname)}/anime_rates?status=planned&limit=${limit}&page=${page}`;
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              proxyReq.setHeader('User-Agent', 'AnimeRoulette/1.0 (personal project)');
              const token = req.headers['x-shikimori-token'];
              if (token) proxyReq.setHeader('Authorization', `Bearer ${token}`);
            });
          },
        },

        // ── MAL: список аниме ────────────────────────────────────────────
        '/api/mal-list': {
          target: 'https://api.myanimelist.net',
          changeOrigin: true,
          rewrite: (path) => {
            const url      = new URL(path, 'http://localhost');
            const username = url.searchParams.get('username') || '';
            const fields   = 'id,title,main_picture,num_episodes,start_date,media_type,status,genres,mean';
            return `/v2/users/${encodeURIComponent(username)}/animelist?status=plan_to_watch&fields=${fields}&limit=1000&nsfw=true&sort=list_updated_at`;
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.MAL_CLIENT_ID) {
                proxyReq.setHeader('X-MAL-CLIENT-ID', env.MAL_CLIENT_ID);
              }
            });
          },
        },

        // ── MAL: постер по mal_id ────────────────────────────────────────
        '/api/mal-poster': {
          target: 'https://api.myanimelist.net',
          changeOrigin: true,
          rewrite: (path) => {
            const url    = new URL(path, 'http://localhost');
            const mal_id = url.searchParams.get('mal_id') || '';
            return `/v2/anime/${mal_id}?fields=main_picture`;
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.MAL_CLIENT_ID) {
                proxyReq.setHeader('X-MAL-CLIENT-ID', env.MAL_CLIENT_ID);
              }
            });
          },
        },

        // ── Kodik: info (Node.js) ────────────────────────────────────────
        '/api/get-info': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },

        // ── Kodik: episodes (Node.js) ────────────────────────────────────
        '/api/get-episodes': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
