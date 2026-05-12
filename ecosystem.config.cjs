module.exports = {
  apps: [
    {
      name: 'office-server',
      script: './server/index.cjs',
      cwd: 'c:/Users/dih51/OneDrive/Desktop/office-project',
      watch: false,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
      env: {
        NODE_ENV: 'development',
        PORT: '3001',
      },
      error_file: './logs/server-error.log',
      out_file: './logs/server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'ollama',
      script: 'C:/Users/dih51/AppData/Local/Programs/Ollama/ollama.exe',
      args: 'serve',
      cwd: 'c:/Users/dih51/OneDrive/Desktop/office-project',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      error_file: './logs/ollama-error.log',
      out_file: './logs/ollama-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
