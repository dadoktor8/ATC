import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  PeopleOutline, DescriptionOutlined, LocationCityOutlined,
  SettingsOutlined, ViewModule, CreditCard, Assignment
} from '@mui/icons-material';
import AppShell from '../components/AppShell';
import AdminDashboard from './AdminDashboard';
import GeneratePage from './GeneratePage';
import CentersPage from './CentersPage';
import SettingsPage from './SettingsPage';
import BatchesPage from './BatchesPage';
import AdmitCardPage from './AdmitCardPage';
import MarkSheetPage from './MarkSheetPage';
import RegistrationPage from './RegistrationPage';
import ResultsEntryPage from './ResultsEntryPage';

const NAV = [
  { path: '/admin',              label: 'Students',    icon: <PeopleOutline /> },
  { path: '/admin/batches',      label: 'Batches',     icon: <ViewModule /> },
  { path: '/admin/admit-card',   label: 'Admit Card',  icon: <CreditCard /> },
  { path: '/admin/mark-sheet',   label: 'Mark Sheet',  icon: <Assignment /> },
  { path: '/admin/generate',     label: 'Documents',   icon: <DescriptionOutlined /> },
  { path: '/admin/centers',      label: 'Centers',     icon: <LocationCityOutlined /> },
  { path: '/admin/settings',     label: 'Settings',    icon: <SettingsOutlined /> },
];

export default function AdminLayout() {
  return (
    <AppShell navItems={NAV} title="Admin — ATC Portal">
      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="register" element={<RegistrationPage />} />
        <Route path="batches" element={<BatchesPage />} />
        <Route path="admit-card" element={<AdmitCardPage />} />
        <Route path="mark-sheet" element={<MarkSheetPage />} />
        <Route path="generate" element={<GeneratePage />} />
        <Route path="centers" element={<CentersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="results/:batchId" element={<ResultsEntryPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AppShell>
  );
}
