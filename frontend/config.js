const CONFIG = {
  API_BASE: window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://mockbot-yil5.onrender.com/api',
};