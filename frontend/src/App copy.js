// src/index.js
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { NextUIProvider } from '@nextui-org/react';

ReactDOM.render(
  <React.StrictMode>
    <NextUIProvider>
      <App />
    </NextUIProvider>
  </React.StrictMode>,
  document.getElementById('root')
);