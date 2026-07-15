import React from 'react';
import { AppProvider } from './shell/AppContext';
import { Titlebar }   from './shell/Titlebar';
import { ViewSlot }   from './shell/ViewSlot';

/**
 * App.tsx — root of the renderer.
 *
 * Structure:
 *   AppProvider  (state)
 *     Titlebar   (navigation)
 *     ViewSlot   (active view)
 *
 * No business logic here. App.tsx is a composition root only.
 */
export default function App() {
  return (
    <AppProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-text-primary">
        <Titlebar />
        <div className="flex flex-1 overflow-hidden">
          <ViewSlot />
        </div>
      </div>
    </AppProvider>
  );
}
