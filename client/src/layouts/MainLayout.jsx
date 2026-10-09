import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';

export default function MainLayout() {
  return (
    <div className="h-screen bg-command-950 flex flex-col text-slate-100 overflow-hidden">
      <Navbar />
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-command-950 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
