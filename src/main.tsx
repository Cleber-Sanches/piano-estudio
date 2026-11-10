import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { input } from './engine/input';
import { initAutoBackup } from './lib/backup';
import { getSettings } from './lib/settings';
import './styles.css';

input.selectedId = getSettings().deviceId;
input.connectMidi();
input.bindPcKeyboard();
initAutoBackup();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
