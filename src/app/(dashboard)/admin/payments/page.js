'use client';
import React, { useState, useEffect } from 'react';
import { CreditCard, History, User, Building2, CheckCircle, AlertCircle, X, Search, Calendar, Filter, Eye, XCircle, Check, Printer, Edit, Trash2, Save, Plus, Download, FileDown } from 'lucide-react';
import { db } from '../../../lib/firebase';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  Timestamp,
  where
} from 'firebase/firestore';
import * as XLSX from 'xlsx';

const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Generate Invoice Number based on payment index
const generateInvoiceNumber = (paymentIndex, paymentDate) => {
  const month = paymentDate ? paymentDate.toDate().getMonth() : new Date().getMonth();
  const paddedIndex = String(paymentIndex + 1).padStart(4, '0');
  return `INV-${month}-${paddedIndex}`;
};

// Print Receipt Function
const printReceipt = (payment) => {
  const printWindow = window.open('', '_blank');

  // Determine Reg No display
  const regNumberDisplay = payment.user?.isGuest ? 'GUEST' : (payment.user?.regNumber || '-');

  const receiptHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payment Receipt - ${payment.invoiceNo || payment.invoiceNumber}</title>
  <style>
    @page {
      size: A5;
      margin: 10mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
    }
    body {
      font-family: 'Helvetica', 'Arial', sans-serif;
      background: white;
      font-size: 11px;
      color: #333;
      line-height: 1.3;
    }
    .receipt-container {
      width: 100%;
      max-width: 148mm;
      margin: 0 auto;
      background: white;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo-placeholder {
      width: 50px;
      height: 50px;
      border: 1px solid #2563eb;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .logo-placeholder img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .header-text {
      text-align: left;
    }
    .stadium-name {
      font-size: 14px;
      font-weight: bold;
      color: #1e40af;
      text-transform: uppercase;
    }
    .reg-no {
      font-size: 9px;
      color: #64748b;
    }
    .receipt-badge {
      font-size: 12px;
      font-weight: bold;
      background: #eff6ff;
      color: #2563eb;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #bfdbfe;
      white-space: nowrap;
    }
    .content-wrapper {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .section-title {
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      color: #64748b;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 2px;
      margin-bottom: 5px;
    }
    .line-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      border-bottom: 1px dashed #f1f5f9;
    }
    .label {
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
      width: 40%;
    }
    .value {
      font-size: 11px;
      color: #0f172a;
      font-weight: 600;
      text-align: right;
      width: 60%;
    }
    .amount-section {
      margin-top: 15px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .amount-label {
      font-size: 12px;
      font-weight: bold;
      color: #1e40af;
    }
    .amount-value {
      font-size: 18px;
      font-weight: bold;
      color: #1e40af;
    }
    .signature-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-top: 30px;
      padding-right: 5px;
    }
    .signature-box {
      text-align: center;
      width: 140px;
    }
    .sign-line {
      border-bottom: 1px solid #333;
      margin-bottom: 5px;
      height: 30px;
    }
    .sign-label {
      font-size: 9px;
      font-weight: bold;
      color: #333;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
    }
    .status-text {
      font-weight: bold;
      text-transform: uppercase;
    }
    .success { color: #166534; }
    .failed { color: #991b1b; }
    .pending { color: #92400e; }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="header-left">
        <div class="logo-placeholder">
           <img src="/raigarh_logo.webp" alt="Logo" />
        </div>
        <div class="header-text">
          <div class="stadium-name">Raigarh Stadium Samiti</div>
          <div class="reg-no">Reg: बि.सं. 1737 / 21.04.1997</div>
        </div>
      </div>
      <div style="text-align: right;">
        <div class="receipt-badge">RECEIPT</div>
        <div style="font-size: 9px; margin-top: 2px; color: #666;">${payment.invoiceNo || payment.invoiceNumber}</div>
      </div>
    </div>

    <div class="content-wrapper">
      <div class="section-title">Payment Details</div>
      
      <div class="line-item">
        <span class="label">Date:</span>
        <span class="value">${formatTimestamp(payment.paymentDate)}</span>
      </div>

      <div class="line-item">
        <span class="label">Name:</span>
        <span class="value">${payment.user?.name || '-'}</span>
      </div>

      <div class="line-item">
        <span class="label">Reg No:</span>
        <span class="value">${regNumberDisplay}</span>
      </div>

      <div class="line-item">
        <span class="label">Facility / Purpose:</span>
        <span class="value">${payment.facility?.name || payment.facilityId || 'General Subscription'}</span>
      </div>

      ${payment.month && payment.month.length > 0 ? `
      <div class="line-item">
        <span class="label">Months Covered:</span>
        <span class="value">${payment.month.join(', ')}</span>
      </div>` : ''}

      <div class="line-item">
        <span class="label">Method:</span>
        <span class="value">${payment.method || 'Cash'}</span>
      </div>

      <div class="line-item">
        <span class="label">Txn ID:</span>
        <span class="value" style="font-size: 9px;">${payment.transactionId || payment.id || '-'}</span>
      </div>

      <div class="line-item">
        <span class="label">Plan:</span>
        <span class="value">${payment.subscription?.planType || payment.planType || 'Standard'}</span>
      </div>

      <div class="line-item">
        <span class="label">Status:</span>
        <span class="value status-text ${payment.status === 'Success' || payment.status === 'completed' ? 'success' :
      payment.status === 'Failed' || payment.status === 'failed' ? 'failed' :
        'pending'
    }">
          ${payment.status === 'completed' ? 'COMPLETED' : payment.status}
        </span>
      </div>

      <div class="line-item">
        <span class="label">Mobile:</span>
        <span class="value">${payment.user?.mobile || '-'}</span>
      </div>

    </div>

    <div class="amount-section">
      <span class="amount-label">TOTAL PAID</span>
      <span class="amount-value">₹${payment.amount || '0'}</span>
    </div>
    <div class="signature-wrapper">
      <div class="signature-box">
        <div class="sign-line"></div>
        <div class="sign-label">Authorized Signatory</div>
      </div>
    </div>

    <div class="footer">
      <p>Raigarh Stadium Samiti, Raigarh (C.G.)</p>
    </div>
  </div>
  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() {
        window.close();
      };
    };
  </script>
</body>
</html>
`;
  printWindow.document.write(receiptHTML);
  printWindow.document.close();
};

/* --- EDIT COMPONENT --- */
const EditPaymentModal = ({ isOpen, onClose, payment, onSave, loading }) => {
  const [formData, setFormData] = useState({
    amount: '',
    transactionId: '',
    method: '',
    status: '',
    paymentDate: '',
    months: []
  });

  const [addMonthVal, setAddMonthVal] = useState(new Date().getMonth().toString());
  const [addYearVal, setAddYearVal] = useState(new Date().getFullYear());

  useEffect(() => {
    if (payment) {
      let dateStr = '';
      if (payment.paymentDate) {
        const date = payment.paymentDate.toDate();
        const offset = date.getTimezoneOffset() * 60000;
        dateStr = new Date(date.getTime() - offset).toISOString().slice(0, 16);
      }

      setFormData({
        amount: payment.amount || 0,
        transactionId: payment.transactionId || payment.id || '',
        method: payment.method || 'Cash',
        status: payment.status || 'pending',
        paymentDate: dateStr,
        months: Array.isArray(payment.month) ? payment.month : []
      });
    }
  }, [payment]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(payment.id, formData);
  };

  const removeMonth = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      months: prev.months.filter((_, index) => index !== indexToRemove)
    }));
  };

  const addMonth = () => {
    const monthName = new Date(addYearVal, addMonthVal).toLocaleString('default', { month: 'long' });
    const newMonthStr = `${monthName} ${addYearVal}`;

    if (!formData.months.includes(newMonthStr)) {
      const updatedMonths = [...formData.months, newMonthStr];
      setFormData(prev => ({ ...prev, months: updatedMonths }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Edit size={20} /> Edit Payment
          </h2>
          <button onClick={onClose}><X size={20} className="text-gray-500 hover:text-gray-700" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID</label>
            <input
              type="text"
              value={formData.transactionId}
              onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="completed">Completed</option>
                <option value="Success">Success</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Online">Online</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>

          <div className="border p-3 rounded-lg bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">Edit Months</label>

            <div className="flex flex-wrap gap-2 mb-3">
              {formData.months.length > 0 ? (
                formData.months.map((m, idx) => (
                  <span key={idx} className="bg-white border border-blue-200 text-blue-700 px-2 py-1 rounded text-xs flex items-center gap-1 shadow-sm">
                    {m}
                    <button type="button" onClick={() => removeMonth(idx)} className="text-red-500 hover:text-red-700">
                      <X size={12} />
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400 italic">No specific months listed</span>
              )}
            </div>

            <div className="flex gap-2">
              <select
                value={addMonthVal}
                onChange={(e) => setAddMonthVal(e.target.value)}
                className="w-1/3 px-2 py-1 text-sm border border-gray-300 rounded"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>
                ))}
              </select>
              <select
                value={addYearVal}
                onChange={(e) => setAddYearVal(e.target.value)}
                className="w-1/3 px-2 py-1 text-sm border border-gray-300 rounded"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={addMonth}
                className="flex-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 flex justify-center items-center"
              >
                <Plus size={16} /> Add
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
            <input
              type="datetime-local"
              value={formData.paymentDate}
              onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-white pb-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Saving...' : <><Save size={16} /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PaymentDetailsModal = ({ isOpen, onClose, payment, user, facility, subscription }) => {
  if (!isOpen || !payment) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard size={24} /> Payment Details
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-600">Transaction ID</p>
              <p className="text-lg font-semibold text-gray-900">{payment.transactionId || payment.id || 'N/A'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-600">Amount</p>
              <p className="text-lg font-semibold text-blue-600">₹{payment.amount}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-600">Payment Date</p>
              <p className="text-lg font-semibold text-gray-900">{formatTimestamp(payment.paymentDate)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-600">Method</p>
              <p className="text-lg font-semibold text-gray-900">{payment.method || 'N/A'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-600">Status</p>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${payment.status === 'Success' || payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                  payment.status === 'Failed' || payment.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                }`}>
                {payment.status === 'completed' ? 'Completed' : payment.status}
              </span>
            </div>
            {payment.qrCodeName && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-600">QR Code Used</p>
                <p className="text-lg font-semibold text-gray-900">{payment.qrCodeName}</p>
              </div>
            )}
            {payment.month && payment.month.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 col-span-2">
                <p className="text-sm font-medium text-gray-600">Months Covered</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {payment.month.map((m, i) => (
                    <span key={i} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded border border-blue-200 font-medium">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <User size={20} /> User Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-600">User Name</p>
              <p className="text-md font-semibold text-gray-900">{user?.name || 'N/A'} {user?.isGuest && <span className="text-xs bg-gray-200 px-1 rounded ml-1">Guest</span>}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-600">User Mobile</p>
              <p className="text-md font-semibold text-gray-900">{user?.mobile || 'N/A'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-600">User ID</p>
              <p className="text-md font-semibold text-gray-900">{payment.userId}</p>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Building2 size={20} /> Facility & Subscription
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-600">Facility Name</p>
              <p className="text-md font-semibold text-gray-900">{facility?.name || 'N/A'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-600">Plan Type</p>
              <p className="text-md font-semibold text-gray-900">{subscription?.planType || payment.planType || 'N/A'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-600">Subscription ID</p>
              <p className="text-md font-semibold text-gray-900">{payment.subscriptionId || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};


const PaymentsPage = () => {
  const [payments, setPayments] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFacility, setFilterFacility] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPaymentDetails, setSelectedPaymentDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [facilities, setFacilities] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);

  // NEW: Month/Year selector for data fetching
  const [fetchMonth, setFetchMonth] = useState(new Date().getMonth());
  const [fetchYear, setFetchYear] = useState(new Date().getFullYear());
  const [exportLoading, setExportLoading] = useState(false);

  // EDIT STATE
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  useEffect(() => {
    loadPayments();
  }, [fetchMonth, fetchYear]); // Reload when month/year changes

  const loadPayments = async () => {
    setDataLoading(true);
    try {
      // Calculate start and end of selected month
      const startOfMonth = new Date(fetchYear, fetchMonth, 1);
      const endOfMonth = new Date(fetchYear, fetchMonth + 1, 0, 23, 59, 59, 999);

      const paymentsRef = collection(db, 'payments');

      // Query with date range to limit documents fetched
      const q = query(
        paymentsRef,
        where('paymentDate', '>=', Timestamp.fromDate(startOfMonth)),
        where('paymentDate', '<=', Timestamp.fromDate(endOfMonth)),
        orderBy('paymentDate', 'desc')
      );

      const paymentsSnap = await getDocs(q);

      const paymentsData = await Promise.all(
        paymentsSnap.docs.map(async (paymentDoc) => {
          const payment = { id: paymentDoc.id, ...paymentDoc.data() };

          let userData = null;
          let facilityData = null;
          let subscriptionData = null;

          if (payment.userId) {
            if (typeof payment.userId.get === 'function') {
              const userDoc = await getDoc(payment.userId);
              if (userDoc.exists()) {
                userData = { id: userDoc.id, ...userDoc.data() };
              }
            }
            else if (typeof payment.userId === 'string') {
              if (payment.isGuest === true) {
                const guestDoc = await getDoc(doc(db, 'guests', payment.userId));
                if (guestDoc.exists()) {
                  userData = { id: guestDoc.id, ...guestDoc.data(), isGuest: true };
                }
              } else {
                let userDoc = await getDoc(doc(db, 'users', payment.userId));
                if (userDoc.exists()) {
                  userData = { id: userDoc.id, ...userDoc.data() };
                } else {
                  const guestDoc = await getDoc(doc(db, 'guests', payment.userId));
                  if (guestDoc.exists()) {
                    userData = { id: guestDoc.id, ...guestDoc.data(), isGuest: true };
                  }
                }
              }
            }
          }

          if (payment.facilityId && typeof payment.facilityId.get === 'function') {
            const facilityDoc = await getDoc(payment.facilityId);
            if (facilityDoc.exists()) {
              facilityData = { id: facilityDoc.id, ...facilityDoc.data() };
            }
          } else if (typeof payment.facilityId === 'string') {
            const facilityDoc = await getDoc(doc(db, 'facilities', payment.facilityId));
            if (facilityDoc.exists()) {
              facilityData = { id: facilityDoc.id, ...facilityDoc.data() };
            }
          }

          if (payment.subscriptionId && typeof payment.subscriptionId.get === 'function') {
            const subscriptionDoc = await getDoc(payment.subscriptionId);
            if (subscriptionDoc.exists()) {
              subscriptionData = { id: subscriptionDoc.id, ...subscriptionDoc.data() };
            }
          } else if (typeof payment.subscriptionId === 'string') {
            const parts = payment.subscriptionId.split('/');
            if (parts.length >= 4 && parts[0] === 'users' && parts[2] === 'subscriptions') {
              const userId = parts[1];
              const subId = parts[3];
              if (userId && subId) {
                const subscriptionDoc = await getDoc(doc(db, 'users', userId, 'subscriptions', subId));
                if (subscriptionDoc.exists()) {
                  subscriptionData = { id: subscriptionDoc.id, ...subscriptionDoc.data() };
                }
              }
            }
          }

          return {
            ...payment,
            user: userData,
            facility: facilityData,
            subscription: subscriptionData,
          };
        })
      );

      setPayments(paymentsData);

      const uniqueFacilities = [...new Set(paymentsData
        .map(p => p.facility?.name || p.facilityId)
        .filter(Boolean))];
      setFacilities(uniqueFacilities);

    } catch (error) {
      console.error('Error loading payments:', error);
      setAlert({ show: true, type: 'error', message: 'Failed to load payments data.' });
    } finally {
      setDataLoading(false);
    }
  };

  const openDetailsModal = (payment) => {
    setSelectedPaymentDetails(payment);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedPaymentDetails(null);
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm("Are you sure you want to permanently delete this payment? This action cannot be undone.")) return;

    setActionLoading(paymentId);
    try {
      await deleteDoc(doc(db, 'payments', paymentId));
      setPayments(prev => prev.filter(p => p.id !== paymentId));
      setAlert({ show: true, type: 'success', message: 'Payment deleted successfully.' });
    } catch (error) {
      console.error("Error deleting payment:", error);
      setAlert({ show: true, type: 'error', message: 'Failed to delete payment.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditClick = (payment) => {
    setEditingPayment(payment);
    setShowEditModal(true);
  };

  const handleSavePayment = async (id, updatedData) => {
    setActionLoading(id);
    try {
      const paymentRef = doc(db, 'payments', id);

      const updatePayload = {
        amount: updatedData.amount,
        transactionId: updatedData.transactionId,
        method: updatedData.method,
        status: updatedData.status,
        month: updatedData.months,
        paymentDate: Timestamp.fromDate(new Date(updatedData.paymentDate))
      };

      await updateDoc(paymentRef, updatePayload);

      setPayments(prev => prev.map(p => {
        if (p.id === id) {
          return { ...p, ...updatePayload };
        }
        return p;
      }));

      setShowEditModal(false);
      setEditingPayment(null);
      setAlert({ show: true, type: 'success', message: 'Payment updated successfully.' });
    } catch (error) {
      console.error("Error updating payment:", error);
      setAlert({ show: true, type: 'error', message: 'Failed to update payment.' });
    } finally {
      setActionLoading(null);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilterStatus('all');
    setFilterFacility('all');
    setFilterPeriod('all');
    setSelectedMonth('');
    setSelectedYear('');
    setSelectedDate('');
  };

  const handleStatusUpdate = async (paymentId, newStatus) => {
    if (!window.confirm(`Are you sure you want to mark this payment as ${newStatus}?`)) return;

    setActionLoading(paymentId);
    try {
      const paymentRef = doc(db, 'payments', paymentId);
      await updateDoc(paymentRef, {
        status: newStatus
      });

      setPayments(prevPayments =>
        prevPayments.map(p => p.id === paymentId ? { ...p, status: newStatus } : p)
      );

      setAlert({ show: true, type: 'success', message: `Payment marked as ${newStatus}` });
    } catch (error) {
      console.error("Error updating payment status:", error);
      setAlert({ show: true, type: 'error', message: 'Failed to update status' });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = (payment.transactionId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (payment.user?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      String(payment.user?.mobile || '').includes(searchTerm) ||
      (payment.id || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || payment.status === filterStatus;

    const matchesFacility = filterFacility === 'all' ||
      payment.facility?.name === filterFacility ||
      payment.facilityId === filterFacility;

    let matchesDate = true;
    if (payment.paymentDate && filterPeriod !== 'all') {
      const paymentDate = payment.paymentDate.toDate();

      if (filterPeriod === 'daily' && selectedDate) {
        const selected = new Date(selectedDate);
        matchesDate = paymentDate.toDateString() === selected.toDateString();
      } else if (filterPeriod === 'monthly' && selectedMonth && selectedYear) {
        matchesDate = paymentDate.getMonth() === parseInt(selectedMonth) &&
          paymentDate.getFullYear() === parseInt(selectedYear);
      } else if (filterPeriod === 'yearly' && selectedYear) {
        matchesDate = paymentDate.getFullYear() === parseInt(selectedYear);
      }
    }

    return matchesSearch && matchesStatus && matchesFacility && matchesDate;
  });

  const filteredStats = {
    total: filteredPayments.length,
    successful: filteredPayments.filter(p => p.status === 'Success' || p.status === 'completed').length,
    failed: filteredPayments.filter(p => p.status === 'Failed' || p.status === 'failed').length,
    totalAmount: filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
  };

  // Calculate facility-wise summary
  const getFacilitySummary = () => {
    const summary = {};
    filteredPayments.forEach(payment => {
      const facilityName = payment.facility?.name || payment.facilityId || 'Unknown';
      if (!summary[facilityName]) {
        summary[facilityName] = { count: 0, total: 0 };
      }
      summary[facilityName].count += 1;
      summary[facilityName].total += payment.amount || 0;
    });
    return summary;
  };


  const exportToPDF = () => {
    setExportLoading(true);
    try {
      const monthName = new Date(fetchYear, fetchMonth).toLocaleString('default', { month: 'long' });
      const facilitySummary = getFacilitySummary(); // Calculate summary data

      const printWindow = window.open('', '_blank');

      const paymentsToExport = [...filteredPayments].sort((a, b) => a.paymentDate - b.paymentDate);
      // Generate Rows for Main Table
      const paymentRows = paymentsToExport.map((payment, index) => `
        <tr class="${index % 2 === 0 ? 'even' : 'odd'}">
          <td>
            <div class="txn-id">${payment.transactionId || payment.id || '-'}</div>
            <div class="invoice-no">${payment.invoiceNo || payment.invoiceNumber || ''}</div>
          </td>
          <td>
            <div class="user-name">${payment.user?.name || '-'}</div>
            <div class="sub-text">${payment.user?.mobile || ''}</div>
          </td>
          <td>${payment.facility?.name || payment.facilityId || '-'}</td>
          <td>${payment.month && payment.month.length > 0 ? payment.month.join(', ') : '-'}</td>
          <td class="amount">₹${payment.amount || 0}</td>
          <td>${payment.method || '-'}</td>
          <td>${formatTimestamp(payment.paymentDate)}</td>
          <td>
            <span class="status-badge ${payment.status === 'Success' || payment.status === 'completed' ? 'success' :
          payment.status === 'Failed' || payment.status === 'failed' ? 'failed' : 'pending'
        }">
              ${payment.status === 'completed' ? 'COMPLETED' : payment.status}
            </span>
          </td>
        </tr>
      `).join('');

      // Generate Rows for Summary Table
      const summaryRows = Object.entries(facilitySummary).map(([facility, data]) => `
        <tr>
          <td>${facility}</td>
          <td style="text-align: center;">${data.count}</td>
          <td style="text-align: right;">₹${data.total.toLocaleString()}</td>
        </tr>
      `).join('') + `
    <tr style="font-weight: bold; background-color: #f1f5f9; border-top: 2px solid #64748b;">
      <td style="padding: 8px;">GRAND TOTAL</td>
      <td style="text-align: center; padding: 8px;">${filteredStats.total}</td>
      <td style="text-align: right; padding: 8px;">₹${filteredStats.totalAmount.toLocaleString()}</td>
    </tr>
  `;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Report - ${monthName} ${fetchYear}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; margin: 0; padding: 0; font-size: 11px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
            .logo-section { display: flex; align-items: center; gap: 15px; }
            .logo-box { width: 50px; height: 50px; border: 1px solid #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
            .org-name { font-size: 18px; font-weight: bold; color: #1e40af; text-transform: uppercase; }
            .reg-text { font-size: 10px; color: #64748b; }
            .report-title { text-align: right; }
            .title-main { font-size: 16px; font-weight: bold; }
            .generated-date { font-size: 10px; color: #666; margin-top: 4px; }
            
            /* Stats Cards */
            .stats-container { display: flex; gap: 15px; margin-bottom: 20px; }
            .stat-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 15px; flex: 1; background: #f8fafc; }
            .stat-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; }
            .stat-value { font-size: 16px; font-weight: bold; margin-top: 4px; color: #0f172a; }
            .stat-value.green { color: #166534; }
            .stat-value.red { color: #991b1b; }
            .stat-value.blue { color: #1e40af; }

            /* Tables */
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background-color: #2563eb; color: white; text-align: left; padding: 8px; font-size: 10px; text-transform: uppercase; }
            td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: middle; }
            tr.even { background-color: #f8fafc; }
            
            /* Specific Column Styles */
            .txn-id { font-weight: bold; color: #333; }
            .invoice-no { font-size: 9px; color: #666; }
            .user-name { font-weight: 600; }
            .sub-text { font-size: 9px; color: #666; }
            .amount { font-weight: bold; color: #1e40af; }
            
            /* Status Badges */
            .status-badge { padding: 3px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase; }
            .status-badge.success { background: #dcfce7; color: #166534; }
            .status-badge.failed { background: #fee2e2; color: #991b1b; }
            .status-badge.pending { background: #fef9c3; color: #854d0e; }

            .section-header { font-size: 12px; font-weight: bold; margin-bottom: 10px; color: #475569; border-left: 3px solid #2563eb; padding-left: 8px; }
            
            /* Signature Section Styles */
            .signature-section { display: flex; justify-content: space-between; margin-top: 60px; padding: 0 50px; page-break-inside: avoid; }
            .sign-box { text-align: center; width: 200px; }
            .sign-line { border-bottom: 1px solid #333; height: 30px; margin-bottom: 5px; }
            .sign-title { font-weight: bold; font-size: 11px; color: #1e40af; }
            
            .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            
            @media print {
              .no-print { display: none; }
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-section">
              <div class="logo-box">
                <img src="/raigarh_logo.webp" alt="Logo" style="width:100%; height:100%; object-fit:contain;" />
              </div>
              <div>
                <div class="org-name">Raigarh Stadium Samiti</div>
                <div class="reg-text">Reg: बि.सं. 1737 / 21.04.1997</div>
              </div>
            </div>
            <div class="report-title">
              <div class="title-main">Payment Report - ${monthName} ${fetchYear}</div>
              <div class="generated-date">Generated: ${new Date().toLocaleString('en-GB')}</div>
            </div>
          </div>

          <!-- Summary Stats -->
          <div class="stats-container">
            <div class="stat-card">
              <div class="stat-label">Total Txns</div>
              <div class="stat-value">${filteredStats.total}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Successful</div>
              <div class="stat-value green">${filteredStats.successful}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Failed</div>
              <div class="stat-value red">${filteredStats.failed}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Amount</div>
              <div class="stat-value blue">₹${filteredStats.totalAmount.toLocaleString()}</div>
            </div>
          </div>

          <!-- Main Data Table -->
          <div class="section-header">Detailed Transactions</div>
          <table>
            <thead>
              <tr>
                <th width="15%">Transaction Details</th>
                <th width="15%">User</th>
                <th width="15%">Facility</th>
                <th width="15%">Months</th>
                <th width="10%">Amount</th>
                <th width="10%">Method</th>
                <th width="10%">Date</th>
                <th width="10%">Status</th>
              </tr>
            </thead>
            <tbody>
              ${paymentRows}
            </tbody>
          </table>

          <!-- Facility Summary Table -->
          <div style="page-break-inside: avoid;">
            <div class="section-header">Summary by Facility / Game</div>
            <table style="width: 60%;">
              <thead>
                <tr>
                  <th style="background-color: #166534;">Facility Name</th>
                  <th style="background-color: #166534; text-align: center;">Count</th>
                  <th style="background-color: #166534; text-align: right;">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                ${summaryRows}
              </tbody>
            </table>
          </div>

          <!-- Signature Section -->
          <div class="signature-section">
            <div class="sign-box">
              <div class="sign-line"></div>
              <div class="sign-title">Assistant Grade </div>
            </div>
            <div class="sign-box">
              <div class="sign-line"></div>
              <div class="sign-title">Stadium Incharge</div>
            </div>
            <div class="sign-box">
              <div class="sign-line"></div>
              <div class="sign-title">Secretary</div>
            </div>
          </div>

          <div class="footer">
            Report - Raigarh Stadium Samiti 
          </div>

          <script>
            window.onload = function() {
              window.print();
              // window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close(); // Important for styles to load

      setAlert({ show: true, type: 'success', message: 'Print window opened successfully!' });
    } catch (error) {
      console.error('Error generating report:', error);
      setAlert({ show: true, type: 'error', message: 'Failed to generate report' });
    } finally {
      setExportLoading(false);
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    setExportLoading(true);
    try {
      const monthName = new Date(fetchYear, fetchMonth).toLocaleString('default', { month: 'long' });

      // Prepare data for main sheet
      const excelData = filteredPayments.map(payment => ({
        'Transaction ID': payment.transactionId || payment.id || '',
        'Invoice No': payment.invoiceNo || payment.invoiceNumber || '',
        'User Name': payment.user?.name || '',
        'User Mobile': payment.user?.mobile || '',
        'Reg No': payment.user?.isGuest ? 'GUEST' : (payment.user?.regNumber || ''),
        'Facility': payment.facility?.name || payment.facilityId || '',
        'Months': payment.month && payment.month.length > 0 ? payment.month.join(', ') : '',
        'Amount (₹)': payment.amount || 0,
        'Method': payment.method || '',
        'Payment Date': formatTimestamp(payment.paymentDate),
        'Status': payment.status || '',
        'Plan Type': payment.subscription?.planType || payment.planType || ''
      }));

      // Prepare summary data
      const facilitySummary = getFacilitySummary();
      const summaryData = Object.entries(facilitySummary).map(([facility, data]) => ({
        'Facility/Game': facility,
        'Payment Count': data.count,
        'Total Amount (₹)': data.total
      }));

      // Add overall summary
      summaryData.push({
        'Facility/Game': 'GRAND TOTAL',
        'Payment Count': filteredStats.total,
        'Total Amount (₹)': filteredStats.totalAmount
      });

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Main data sheet
      const ws1 = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      ws1['!cols'] = [
        { wch: 25 }, // Transaction ID
        { wch: 20 }, // Invoice No
        { wch: 25 }, // User Name
        { wch: 15 }, // Mobile
        { wch: 15 }, // Reg No
        { wch: 25 }, // Facility
        { wch: 30 }, // Months
        { wch: 12 }, // Amount
        { wch: 15 }, // Method
        { wch: 20 }, // Date
        { wch: 12 }, // Status
        { wch: 15 }  // Plan Type
      ];

      XLSX.utils.book_append_sheet(wb, ws1, 'Payments');

      // Summary sheet
      const ws2 = XLSX.utils.json_to_sheet(summaryData);
      ws2['!cols'] = [
        { wch: 30 },
        { wch: 15 },
        { wch: 20 }
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

      // Write file
      XLSX.writeFile(wb, `Payment_Report_${monthName}_${fetchYear}.xlsx`);
      setAlert({ show: true, type: 'success', message: 'Excel exported successfully!' });
    } catch (error) {
      console.error('Error exporting Excel:', error);
      setAlert({ show: true, type: 'error', message: 'Failed to export Excel' });
    } finally {
      setExportLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payments data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {alert.show && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${alert.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}>
          {alert.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{alert.message}</span>
          <button onClick={() => setAlert({ show: false, type: '', message: '' })}>
            <X size={18} />
          </button>
        </div>
      )}

      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment History</h1>
          <p className="text-gray-600">View and manage all payment transactions</p>
        </div>

        {/* Month/Year Selector */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={18} className="text-blue-600" />
            <span className="text-sm font-semibold text-gray-700">Fetch Data For:</span>
          </div>
          <div className="flex gap-2">
            <select
              value={fetchMonth}
              onChange={(e) => setFetchMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              value={fetchYear}
              onChange={(e) => setFetchYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Payments</p>
              <p className="text-2xl font-bold text-gray-900">{filteredStats.total}</p>
            </div>
            <History className="text-blue-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Successful</p>
              <p className="text-2xl font-bold text-green-600">{filteredStats.successful}</p>
            </div>
            <CheckCircle className="text-green-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600">{filteredStats.failed}</p>
            </div>
            <AlertCircle className="text-red-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-blue-600">₹{filteredStats.totalAmount.toLocaleString()}</p>
            </div>
            <CreditCard className="text-blue-500" size={32} />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          <button
            onClick={resetFilters}
            className="ml-auto text-sm text-blue-600 hover:text-blue-800"
          >
            Reset All
          </button>

          {/* Export Buttons */}
          <div className="flex gap-2 ml-4">
            <button
              onClick={exportToPDF}
              disabled={exportLoading || filteredPayments.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <FileDown size={16} />
              {exportLoading ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              onClick={exportToExcel}
              disabled={exportLoading || filteredPayments.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Download size={16} />
              {exportLoading ? 'Exporting...' : 'Export Excel'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            placeholder="Search by transaction ID, user name, or mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="Success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <select
            value={filterFacility}
            onChange={(e) => setFilterFacility(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Facilities</option>
            {facilities.map((facility, index) => (
              <option key={index} value={facility}>{facility}</option>
            ))}
          </select>

          <select
            value={filterPeriod}
            onChange={(e) => {
              setFilterPeriod(e.target.value);
              if (e.target.value === 'all') {
                setSelectedDate('');
                setSelectedMonth('');
                setSelectedYear('');
              }
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Time</option>
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        {filterPeriod !== 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filterPeriod === 'daily' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            )}

            {(filterPeriod === 'monthly' || filterPeriod === 'yearly') && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Year</option>
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            )}

            {filterPeriod === 'monthly' && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Month</option>
                <option value="0">January</option>
                <option value="1">February</option>
                <option value="2">March</option>
                <option value="3">April</option>
                <option value="4">May</option>
                <option value="5">June</option>
                <option value="6">July</option>
                <option value="7">August</option>
                <option value="8">September</option>
                <option value="9">October</option>
                <option value="10">November</option>
                <option value="11">December</option>
              </select>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Name</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facility</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Months</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Date</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                    No payments found matching the filters
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment, index) => {
                  return (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-2 py-4 text-xs text-gray-900">
                        <span className="font-medium">{payment.transactionId || payment.id}</span>
                        <br />
                        <span className="text-gray-500">{payment.invoiceNo || payment.invoiceNumber}</span>
                      </td>
                      <td className="px-2 py-4 text-sm text-gray-600">
                        {payment.user?.name || 'N/A'}
                        {payment.user?.isGuest && <span className="text-[10px] bg-gray-200 px-1 rounded ml-1 text-gray-600">Guest</span>}
                      </td>
                      <td className="px-2 py-4 text-sm text-gray-600">{payment.facility?.name || payment.facilityId || 'N/A'}</td>

                      <td className="px-2 py-4 text-xs text-gray-700">
                        {payment.month && payment.month.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {payment.month.map((m, i) => (
                              <span key={i} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] border border-gray-200 whitespace-nowrap">
                                {m}
                              </span>
                            ))}
                          </div>
                        ) : payment.startDate && payment.endDate ? (
                          <>
                            <div>{payment.startDate.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</div>
                            <div className="text-gray-400 text-[10px]">to</div>
                            <div>{payment.endDate.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</div>
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-2 py-4 text-sm text-blue-600 font-semibold">₹{payment.amount || 'N/A'}</td>
                      <td className="px-2 py-4 text-sm text-gray-600">{payment.method || 'N/A'}</td>
                      <td className="px-2 py-4 text-xs text-gray-600">{formatTimestamp(payment.paymentDate)}</td>
                      <td className="px-2 py-4">
                        <span className={`px-2 py-1 text-[10px] font-semibold rounded-full ${payment.status === 'Success' || payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                            payment.status === 'Failed' || payment.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                          }`}>
                          {payment.status === 'completed' ? 'Completed' : payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 items-start">
                          <div className="flex gap-1 flex-wrap">
                            <button
                              onClick={() => openDetailsModal(payment)}
                              className="px-6 py-1 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 text-xs font-medium border border-indigo-200 flex items-center gap-1"
                              title="View Details"
                            >
                              <Eye size={12} />
                            </button>

                            <button
                              onClick={() => printReceipt(payment)}
                              className="px-6 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 text-xs font-medium border border-blue-200 flex items-center gap-1"
                              title="Print Receipt"
                            >
                              <Printer size={12} />
                            </button>
                          </div>

                          <div className="flex gap-1 flex-wrap">
                            <button
                              onClick={() => handleEditClick(payment)}
                              className="px-6 py-1 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 text-xs font-medium border border-gray-200 flex items-center gap-1"
                              title="Edit Payment"
                            >
                              <Edit size={12} />
                            </button>

                            <button
                              onClick={() => handleDeletePayment(payment.id)}
                              className="px-6 py-1 bg-red-50 text-red-600 rounded-md hover:bg-red-100 text-xs font-medium border border-red-200 flex items-center gap-1"
                              title="Delete Payment"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          {payment.status === 'pending' && (
                            <div className="flex gap-1 flex-wrap">
                              <button
                                onClick={() => handleStatusUpdate(payment.id, 'completed')}
                                disabled={actionLoading === payment.id}
                                className="px-6 py-3 bg-green-50 text-green-600 rounded-md hover:bg-green-100 text-xs font-medium border border-green-200 flex items-center gap-1 disabled:opacity-50"
                                title="Approve Payment"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(payment.id, 'failed')}
                                disabled={actionLoading === payment.id}
                                className="px-6 py-3 bg-red-50 text-red-600 rounded-md hover:bg-red-100 text-xs font-medium border border-red-200 flex items-center gap-1 disabled:opacity-50"
                                title="Reject Payment"
                              >
                                <XCircle size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentDetailsModal
        isOpen={showDetailsModal}
        onClose={closeDetailsModal}
        payment={selectedPaymentDetails}
        user={selectedPaymentDetails?.user}
        facility={selectedPaymentDetails?.facility}
        subscription={selectedPaymentDetails?.subscription}
      />

      <EditPaymentModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        payment={editingPayment}
        onSave={handleSavePayment}
        loading={!!actionLoading}
      />
    </div>
  );
};

export default PaymentsPage;