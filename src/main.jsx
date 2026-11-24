import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import SetupScreen from './SetupScreen.jsx';
import { StoreProvider } from './store/StoreContext.jsx';
import { supabaseConfigured } from './lib/supabase.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {supabaseConfigured ? (
      <StoreProvider>
        <App />
      </StoreProvider>
    ) : (
      <SetupScreen />
    )}
  </React.StrictMode>
);
