import axios from 'axios';

// Localhost dev: no env var → '/api' → CRA proxy → localhost:4000 (no CORS needed)
// Ngrok / staging: set REACT_APP_API_URL=https://xxxx.ngrok.io/api in .env
const BASE = process.env.REACT_APP_API_URL || '/api';
const api = axios.create({
  baseURL: BASE,
  headers: { 'ngrok-skip-browser-warning': '1' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('atc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('atc_token');
      localStorage.removeItem('atc_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const login = async (username, password) => {
  const res = await api.post('/auth/login', { username, password });
  if (res.data.token) localStorage.setItem('atc_token', res.data.token);
  return res;
};

export const changePassword = (current_password, new_password) =>
  api.post('/auth/change-password', { current_password, new_password });

export const getCenters = () => api.get('/centers');
export const getCenterByCode = (code) => api.get(`/centers/by-code/${code}`);
export const findOrCreateCenter = (data) => api.post('/centers/find-or-create', data);
export const createCenter = (data) => api.post('/centers', data);
export const updateCenter = (id, data) => api.put(`/centers/${id}`, data);
export const deleteCenter = (id) => api.delete(`/centers/${id}`);

export const getStudents = (params = {}) => api.get('/students', { params });
export const getStudent = (id) => api.get(`/students/${id}`);
export const createStudent = (data) => api.post('/students', data);
export const bulkCreateStudents = (students) => api.post('/students/bulk', { students });
export const updateStudent = (id, data) => api.put(`/students/${id}`, data);
export const deleteStudent = (id) => api.delete(`/students/${id}`);
export const previewRollNumber = (session, centerId) =>
  api.get('/students/generate-roll', { params: { session, center_id: centerId } });

export const getBatches = (params = {}) => api.get('/batches', { params });
export const getBatch = (id) => api.get(`/batches/${id}`);
export const getBatchStudents = (id) => api.get(`/batches/${id}/students`);
export const createBatch = (data) => api.post('/batches', data);
export const updateBatch = (id, data) => api.put(`/batches/${id}`, data);
export const deleteBatch = (id) => api.delete(`/batches/${id}`);
export const autoCreateBatch = (data) => api.post('/batches/auto', data);
export const assignStudentsToBatch = (batchId, student_ids) =>
  api.post(`/batches/${batchId}/assign`, { student_ids });
export const removeStudentFromBatch = (batchId, studentId) =>
  api.delete(`/batches/${batchId}/students/${studentId}`);

export const downloadBatchAdmitCardsPdf = (batchId) =>
  api.get('/generate/admit-cards-pdf', { params: { batch_id: batchId }, responseType: 'blob' });
export const getStudentAdmitCardPdf = (studentId) =>
  api.get(`/generate/admit-card-pdf/${studentId}`, { responseType: 'blob' });

export const getMarks = (studentId) => api.get(`/marks/${studentId}`);
export const saveMarks = (studentId, data) => api.post(`/marks/${studentId}`, data);
export const getBatchMarks = (batchId) => api.get(`/marks/batch/${batchId}`);

export const downloadAdmitCard = (studentId) =>
  api.get(`/generate/admit-card-pdf/${studentId}`, { responseType: 'blob' });
export const downloadAdmitCards = (params = {}) =>
  api.get('/generate/admit-cards', { params, responseType: 'blob' });
export const downloadAllocationSheet = (params = {}) =>
  api.get('/generate/allocation-sheet', { params, responseType: 'blob' });
export const downloadAllocationSheetPdf = (batchId) =>
  api.get('/generate/allocation-sheet-pdf', { params: { batch_id: batchId }, responseType: 'blob' });
export const downloadResultSheetPdf = (batchId) =>
  api.get('/generate/result-sheet-pdf', { params: { batch_id: batchId }, responseType: 'blob' });
export const downloadResultSheet = (params = {}) =>
  api.get('/generate/result-sheet', { params, responseType: 'blob' });
export const downloadMarksheet = (studentId) =>
  api.get(`/generate/marksheet/${studentId}`, { responseType: 'blob' });
export const downloadMarkSheetPdf = (batchId) =>
  api.get('/generate/mark-sheet-pdf', { params: { batch_id: batchId }, responseType: 'blob' });
export const getStudentMarkSheetPdf = (studentId) =>
  api.get(`/generate/mark-sheet-pdf/${studentId}`, { responseType: 'blob' });

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default api;
