import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ArtDefs } from './art/kit';
import { createBrowserStore, StoreContext } from './game';
import './styles.css';

const store = createBrowserStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreContext.Provider value={store}>
      <ArtDefs />
      <App />
    </StoreContext.Provider>
  </StrictMode>,
);
