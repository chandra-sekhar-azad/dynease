import React, { useState, useEffect } from 'react';
import { QrCode, Plus, Download, Printer, Trash2, Loader2, X, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import JSZip from 'jszip';
import { useSocketEvents } from '../../lib/socket';
import { showConfirm, toast } from '../../context/DialogContext';

const QR_FORMATS = ['png', 'jpg', 'pdf'];

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Could not render the QR code image.'));
  image.src = src;
});

const safeFilePart = (value) => (
  String(value || 'table')
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'table'
);

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

const createTableQRCodeCanvas = async (table) => {
  const source = document.getElementById(`qr-${table._id}`);
  if (!source) throw new Error('QR code is not available on this page.');

  const svg = source.cloneNode(true);
  const width = 1000;
  const padding = 80;
  const qrSize = width - padding * 2;
  // Render the vector QR at the final image size so it stays sharp.
  svg.setAttribute('width', String(qrSize));
  svg.setAttribute('height', String(qrSize));
  if (!svg.getAttribute('xmlns')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  const svgBlob = new Blob(
    [new XMLSerializer().serializeToString(svg)],
    { type: 'image/svg+xml;charset=utf-8' }
  );
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement('canvas');
    const title = `Table ${table.tableNumber}`;
    const customName = (table.tableName || '').trim();
    const hasCustomName = customName && customName.toLowerCase() !== title.toLowerCase();
    const titleTop = padding + qrSize + 90;
    const height = titleTop + (hasCustomName ? 205 : 145);

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, padding, padding, qrSize, qrSize);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#111827';
    ctx.font = '700 62px Arial, sans-serif';
    ctx.fillText(title, width / 2, titleTop);

    if (hasCustomName) {
      ctx.fillStyle = '#4b5563';
      ctx.font = '500 38px Arial, sans-serif';
      ctx.fillText(customName, width / 2, titleTop + 58);
    }

    ctx.fillStyle = '#6b7280';
    ctx.font = '400 30px Arial, sans-serif';
    ctx.fillText('Scan to Order', width / 2, titleTop + (hasCustomName ? 126 : 64));

    return canvas;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
};

const canvasToImageBlob = (canvas, format) => {
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error(`Could not create the ${format.toUpperCase()} file.`));
    }, mimeType, format === 'jpg' ? 0.95 : undefined);
  });
};

const createQRCodePdf = async (tables) => {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;

  for (let index = 0; index < tables.length; index += 1) {
    if (index > 0) pdf.addPage();

    const canvas = await createTableQRCodeCanvas(tables[index]);
    const scale = Math.min(
      (pageWidth - margin * 2) / canvas.width,
      (pageHeight - margin * 2) / canvas.height
    );
    const renderWidth = canvas.width * scale;
    const renderHeight = canvas.height * scale;
    const x = (pageWidth - renderWidth) / 2;
    const y = (pageHeight - renderHeight) / 2;

    // JPEG keeps multi-page PDFs reasonably small while remaining scan-friendly
    // because the QR source is high resolution and uses high error correction.
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', x, y, renderWidth, renderHeight);
  }

  return pdf.output('blob');
};

export default function TablesManagement() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [planLimits, setPlanLimits] = useState(null);
  const [formData, setFormData] = useState({ tableNumber: '', tableName: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTableIds, setSelectedTableIds] = useState([]);
  const [qrDownloading, setQrDownloading] = useState(null);
  const [qrFormat, setQrFormat] = useState('png');

  const getHeaders = (includeContentType = true) => {
    const token = localStorage.getItem('token');
    const hostname = window.location.hostname;
    const headers = { 'Authorization': `Bearer ${token}` };
    if (includeContentType) headers['Content-Type'] = 'application/json';
    let subdomain = '';
    if (hostname.includes('dynease.in') && hostname !== 'dynease.in' && hostname !== 'www.dynease.in') {
      subdomain = hostname.split('.')[0];
    } else if (hostname.includes('localhost') && hostname !== 'localhost') {
      subdomain = hostname.split('.')[0];
    }
    if (subdomain) headers['x-tenant-subdomain'] = subdomain;
    return headers;
  };

  const fetchTables = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/tables`, {
        headers: getHeaders(false)
      });
      const data = await res.json();
      if (data.success) {
        setTables(data.data.tables);
        if (data.data.limits) {
          setPlanLimits(data.data.limits);
        }
      }
    } catch (err) {
      console.error('Failed to fetch tables', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchSubscriptionLimits();

    // Poll as a resilient fallback for environments without websockets.
    const interval = setInterval(fetchTables, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchSubscriptionLimits = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/subscription`, {
        headers: getHeaders(false)
      });
      const data = await res.json();
      if (data.success && data.data?.limits) {
        setPlanLimits(data.data.limits);
      }
    } catch (e) {
      // silent fallback
    }
  };

  // Realtime: refresh the table grid whenever a table or order changes.
  useSocketEvents({
    table_updated: () => fetchTables(),
    order_updated: () => fetchTables(),
  });


  const maxTables = planLimits?.maxTables ?? null;
  const isTableLimitReached = maxTables !== null && maxTables !== undefined && tables.length >= maxTables;

  const handleAddTable = async (e) => {
    e.preventDefault();
    if (isTableLimitReached) {
      setError('Your tables limit reached contact admin');
      return;
    }
    setActionLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/tables`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (res.ok) {
        setTables([data.data.table, ...tables]);
        setShowAddModal(false);
        setFormData({ tableNumber: '', tableName: '' });
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Table',
      message: 'Are you sure you want to delete this table? Customers will no longer be able to scan and place orders at this table.',
      confirmText: 'Delete Table',
      confirmVariant: 'danger',
      icon: 'danger'
    });
    if (!confirmed) return;
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/tables/${id}`, {
        method: 'DELETE',
        headers: getHeaders(false)
      });
      
      if (res.ok) {
        setTables(tables.filter(t => t._id !== id));
        toast.success('Table deleted successfully');
      } else {
        toast.error('Failed to delete table');
      }
    } catch (err) {
      console.error('Failed to delete table', err);
      toast.error('Failed to delete table');
    }
  };

  const handleFreeTable = async (table) => {
    const confirmed = await showConfirm({
      title: 'Free Table',
      message: `Free Table ${table.tableNumber}? This will cancel any active table occupation and allow new customers to scan.`,
      confirmText: 'Free Table',
      confirmVariant: 'warning',
      icon: 'warning'
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/tables/${table._id}/cancel-allocation`, {
        method: 'POST',
        headers: getHeaders(false)
      });
      if (res.ok) {
        setTables(tables.map(t => t._id === table._id ? { ...t, isOccupied: false } : t));
        fetchTables();
        toast.success(`Table ${table.tableNumber} is now free`);
      } else {
        toast.error('Failed to free table');
      }
    } catch (err) {
      console.error('Failed to free table', err);
      toast.error('Failed to free table');
    }
  };

  const handleToggleStatus = async (table) => {
    const newStatus = table.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/tables/${table._id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        setTables(tables.map(t => t._id === table._id ? { ...t, status: newStatus } : t));
      }
    } catch (err) {
      console.error('Failed to update table status', err);
    }
  };

  const printQR = (table) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Table ${table.tableNumber} QR Code</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { text-align: center; border: 2px solid #000; padding: 2rem; border-radius: 1rem; }
            h1 { margin-bottom: 0.5rem; }
            p { color: #666; margin-bottom: 2rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Table ${table.tableNumber}</h1>
            <p>${table.tableName || 'Scan to Order'}</p>
            <div id="qr-container"></div>
          </div>
          <script>
            // We'll just trigger print and they can see it. In a real app we'd draw the SVG here.
            window.print();
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const toggleTableSelection = (id) => {
    setSelectedTableIds((prev) => (
      prev.includes(id) ? prev.filter((tableId) => tableId !== id) : [...prev, id]
    ));
  };

  const selectedTables = tables.filter((table) => selectedTableIds.includes(table._id));
  const allTablesSelected = tables.length > 0 && tables.every((table) => selectedTableIds.includes(table._id));

  const toggleSelectAllTables = () => {
    setSelectedTableIds(allTablesSelected ? [] : tables.map((table) => table._id));
  };

  const downloadTablesQR = async (targetTables, key) => {
    if (!targetTables.length || qrDownloading) return;

    const format = qrFormat;
    setQrDownloading(key);
    try {
      if (format === 'pdf') {
        const pdfBlob = await createQRCodePdf(targetTables);
        const filename = targetTables.length === 1
          ? `table-${safeFilePart(targetTables[0].tableNumber)}-qr.pdf`
          : 'table-qr-codes.pdf';
        triggerDownload(pdfBlob, filename);
        toast.success(targetTables.length === 1
          ? `QR code for Table ${targetTables[0].tableNumber} downloaded as PDF`
          : `${targetTables.length} QR codes downloaded as a combined PDF`);
      } else if (targetTables.length === 1) {
        const table = targetTables[0];
        const canvas = await createTableQRCodeCanvas(table);
        const image = await canvasToImageBlob(canvas, format);
        triggerDownload(image, `table-${safeFilePart(table.tableNumber)}-qr.${format}`);
        toast.success(`QR code for Table ${table.tableNumber} downloaded as ${format.toUpperCase()}`);
      } else {
        const zip = new JSZip();
        for (const table of targetTables) {
          const canvas = await createTableQRCodeCanvas(table);
          const image = await canvasToImageBlob(canvas, format);
          zip.file(`table-${safeFilePart(table.tableNumber)}-qr.${format}`, image);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        triggerDownload(zipBlob, `table-qr-codes-${format}.zip`);
        toast.success(`${targetTables.length} ${format.toUpperCase()} QR codes downloaded as a ZIP`);
      }
    } catch (err) {
      console.error('Failed to download QR code', err);
      toast.error('Failed to download QR code');
    } finally {
      setQrDownloading(null);
    }
  };

  const downloadQR = (table) => downloadTablesQR([table], table._id);
  const downloadAllQR = () => downloadTablesQR(tables, 'all');
  const downloadSelectedQR = () => downloadTablesQR(selectedTables, 'selected');

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="animate-spin text-green-500 w-8 h-8" /></div>;

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tables & QR Codes</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Manage your restaurant tables and stable QR codes.</p>
        </div>
        {isTableLimitReached ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-2xs w-full sm:w-auto">
            <AlertCircle size={18} className="text-amber-600 shrink-0" />
            <span>Your tables limit reached contact admin</span>
          </div>
        ) : (
          <button onClick={() => setShowAddModal(true)} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors w-full sm:w-auto shrink-0 shadow-sm cursor-pointer">
            <Plus size={20} /> Add New Table
          </button>
        )}
      </div>

      {tables.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-500 flex flex-col items-center">
          <QrCode size={48} className="text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">No tables found</h3>
          <p className="mb-6">Add your first table to generate a stable QR code.</p>
          {!isTableLimitReached ? (
            <button onClick={() => setShowAddModal(true)} className="bg-green-100 text-green-700 hover:bg-green-200 px-4 py-2 rounded-lg font-medium cursor-pointer">Add Table</button>
          ) : (
            <p className="text-amber-700 text-xs sm:text-sm font-semibold">Your tables limit reached contact admin</p>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allTablesSelected}
                  onChange={toggleSelectAllTables}
                  className="h-4 w-4 accent-green-600 cursor-pointer"
                />
                Select all tables
              </label>
              <div className="inline-flex items-center self-start rounded-lg border border-gray-200 bg-white p-0.5" role="group" aria-label="QR download format">
                <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Format</span>
                {QR_FORMATS.map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setQrFormat(format)}
                    disabled={qrDownloading !== null}
                    aria-pressed={qrFormat === format}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-colors disabled:cursor-not-allowed ${
                      qrFormat === format
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {format}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              {selectedTables.length > 0 && (
                <button
                  onClick={downloadSelectedQR}
                  disabled={qrDownloading !== null}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {qrDownloading === 'selected' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Download selected ({selectedTables.length})
                </button>
              )}
              <button
                onClick={downloadAllQR}
                disabled={qrDownloading !== null}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {qrDownloading === 'all' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Download all
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {tables.map(table => (
              <div
                key={table._id}
                className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors ${
                  selectedTableIds.includes(table._id)
                    ? 'border-green-400 ring-1 ring-green-200'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <div className="flex justify-between items-start mb-6 gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedTableIds.includes(table._id)}
                      onChange={() => toggleTableSelection(table._id)}
                      aria-label={`Select Table ${table.tableNumber}`}
                      className="mt-2 h-4 w-4 accent-green-600 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="text-2xl font-bold text-gray-900 mb-1">Table {table.tableNumber}</h3>
                      <p className="text-gray-500 font-medium">{table.tableName || 'Main Area'} • {table.capacity || 4} Seats</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      table.isOccupied ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {table.isOccupied ? '• Occupied' : '• Free'}
                    </span>
                    {table.isOccupied && (
                      <button
                        onClick={() => handleFreeTable(table)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors shadow-2xs cursor-pointer"
                        title="Cancel active occupation and mark table as free"
                      >
                        Free Table
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleStatus(table)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-colors border ${
                        table.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                      }`}
                      title="Click to toggle status"
                    >
                      {table.status}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center bg-gray-50 p-6 rounded-xl border border-gray-100 mb-6">
                  <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                    <QRCodeSVG id={`qr-${table._id}`} value={table.qrCodeUrl} size={150} level="H" />
                  </div>
                  <p className="text-sm font-bold text-gray-800 text-center">{table.tableName || `Table ${table.tableNumber}`}</p>
                  <p className="text-sm font-bold text-gray-600 uppercase tracking-widest text-center mt-1">Scan to Order</p>
                  <p className="text-xs text-gray-400 mt-2 text-center break-all">{table.qrCodeUrl}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => downloadQR(table)}
                    disabled={qrDownloading !== null}
                    className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {qrDownloading === table._id ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                    {qrDownloading === table._id ? 'Saving...' : `Download ${qrFormat.toUpperCase()}`}
                  </button>
                  <button onClick={() => printQR(table)} className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm">
                    <Printer size={18} /> Print
                  </button>
                  <button onClick={() => handleDelete(table._id)} className="p-2.5 text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-xl transition-colors shadow-sm">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900">Add New Table</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddTable} className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Table Number *</label>
                  <input 
                    required 
                    type="text" 
                    value={formData.tableNumber}
                    onChange={e => setFormData({...formData, tableNumber: e.target.value})}
                    placeholder="E.g. 12 or T-12" 
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Table Name/Area (Optional)</label>
                  <input 
                    type="text" 
                    value={formData.tableName}
                    onChange={e => setFormData({...formData, tableName: e.target.value})}
                    placeholder="E.g. Window Seat, Balcony" 
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" 
                  />
                </div>
              </div>
              <div className="mt-8 flex gap-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="flex-1 py-3 font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors flex justify-center items-center">
                  {actionLoading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Create Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
