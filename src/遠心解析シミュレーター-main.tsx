import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './遠心解析シミュレーター';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);