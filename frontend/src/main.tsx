import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { crearRouter } from './app/router';
import './shared/styles/index.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('No se encontró el elemento #root');

createRoot(raiz).render(
  <StrictMode>
    <App router={crearRouter()} />
  </StrictMode>,
);
