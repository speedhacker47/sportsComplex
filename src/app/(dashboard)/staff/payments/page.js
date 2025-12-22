'use client';
import React, { useState, useEffect } from 'react';
import { CreditCard, History, User, Building2, CheckCircle, AlertCircle, X, Search } from 'lucide-react';
import { db } from '../../../lib/firebase'; 
import { collection, getDocs, doc, getDoc, query, orderBy } from 'firebase/firestore';

const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return date.toLocaleDateString('en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const PaymentDetailsModal = ({ isOpen, onClose, payment, user, facility, subscription }) => {
  if (!isOpen || !payment) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><CreditCard size={24} /> Payment Details</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
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
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${payment.status === 'Success' || payment.status === 'completed' ? 'bg-green-100 text-green-800' : payment.status === 'Failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {payment.status === 'completed' ? 'Completed' : payment.status}
              </span>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><User size={20} /> User Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-600">User Name</p>
              <p className="text-md font-semibold text-gray-900">{user?.name || 'N/A'}</p>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><Building2 size={20} /> Facility & Subscription</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-600">Facility Name</p>
              <p className="text-md font-semibold text-gray-900">{facility?.name || payment.facilityId || 'N/A'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-600">Plan Type</p>
              <p className="text-md font-semibold text-gray-900">{subscription?.planType || payment.planType || 'N/A'}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button type="button" onClick={onClose} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Close</button>
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

  useEffect(() => { loadPayments(); }, []);

  const loadPayments = async () => {
    setDataLoading(true);
    try {
      const paymentsRef = collection(db, 'payments');
      const paymentsSnap = await getDocs(query(paymentsRef, orderBy('paymentDate', 'desc')));

      const paymentsData = await Promise.all(
        paymentsSnap.docs.map(async (paymentDoc) => {
          const payment = { id: paymentDoc.id, ...paymentDoc.data() };
          let userData = null, facilityData = null, subscriptionData = null;

          // Fetch user - handle string userId
          if (typeof payment.userId === 'string') {
            const userDoc = await getDoc(doc(db, 'users', payment.userId));
            if (userDoc.exists()) userData = { id: userDoc.id, ...userDoc.data() };
          }

          // Fetch facility - handle string facilityId
          if (typeof payment.facilityId === 'string') {
            const facilityDoc = await getDoc(doc(db, 'facilities', payment.facilityId));
            if (facilityDoc.exists()) facilityData = { id: facilityDoc.id, ...facilityDoc.data() };
          }

          // Fetch subscription if subscriptionId exists
          if (payment.subscriptionId && typeof payment.subscriptionId === 'string') {
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

          return { ...payment, user: userData, facility: facilityData, subscription: subscriptionData };
        })
      );

      setPayments(paymentsData);
      const uniqueFacilities = [...new Set(paymentsData.map(p => p.facility?.name || p.facilityId).filter(Boolean))];
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

  const resetFilters = () => {
    setSearchTerm(''); setFilterStatus('all'); setFilterFacility('all');
    setFilterPeriod('all'); setSelectedMonth(''); setSelectedYear(''); setSelectedDate('');
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = (payment.transactionId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                          (payment.user?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                          (payment.user?.mobile || '').includes(searchTerm) ||
                          (payment.id || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || payment.status === filterStatus;
    const matchesFacility = filterFacility === 'all' || payment.facility?.name === filterFacility || payment.facilityId === filterFacility;
    
    let matchesDate = true;
    if (payment.paymentDate && filterPeriod !== 'all') {
      const paymentDate = payment.paymentDate.toDate();
      if (filterPeriod === 'daily' && selectedDate) {
        const selected = new Date(selectedDate);
        matchesDate = paymentDate.toDateString() === selected.toDateString();
      } else if (filterPeriod === 'monthly' && selectedMonth && selectedYear) {
        matchesDate = paymentDate.getMonth() === parseInt(selectedMonth) && paymentDate.getFullYear() === parseInt(selectedYear);
      } else if (filterPeriod === 'yearly' && selectedYear) {
        matchesDate = paymentDate.getFullYear() === parseInt(selectedYear);
      }
    }
    return matchesSearch && matchesStatus && matchesFacility && matchesDate;
  });

  const filteredStats = {
    total: filteredPayments.length,
    successful: filteredPayments.filter(p => p.status === 'Success' || p.status === 'completed').length,
    failed: filteredPayments.filter(p => p.status === 'Failed').length,
    totalAmount: filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
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
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${alert.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {alert.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{alert.message}</span>
          <button onClick={() => setAlert({ show: false, type: '', message: '' })}><X size={18} /></button>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment History</h1>
        <p className="text-gray-600">View and manage all payment transactions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Total Payments</p><p className="text-2xl font-bold text-gray-900">{filteredStats.total}</p></div>
            <History className="text-blue-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Successful</p><p className="text-2xl font-bold text-green-600">{filteredStats.successful}</p></div>
            <CheckCircle className="text-green-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Failed</p><p className="text-2xl font-bold text-red-600">{filteredStats.failed}</p></div>
            <AlertCircle className="text-red-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Total Amount</p><p className="text-2xl font-bold text-blue-600">₹{filteredStats.totalAmount.toLocaleString()}</p></div>
            <CreditCard className="text-blue-500" size={32} />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          <button onClick={resetFilters} className="ml-auto text-sm text-blue-600 hover:text-blue-800">Reset All</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input type="text" placeholder="Search by transaction ID, user name, or mobile..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="Success">Success</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <select value={filterFacility} onChange={(e) => setFilterFacility(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="all">All Facilities</option>
            {facilities.map((facility, index) => (<option key={index} value={facility}>{facility}</option>))}
          </select>

          <select value={filterPeriod} onChange={(e) => { setFilterPeriod(e.target.value); if (e.target.value === 'all') { setSelectedDate(''); setSelectedMonth(''); setSelectedYear(''); } }} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="all">All Time</option>
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        {filterPeriod !== 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filterPeriod === 'daily' && (<input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />)}
            {(filterPeriod === 'monthly' || filterPeriod === 'yearly') && (
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="">Select Year</option>
                {yearOptions.map(year => (<option key={year} value={year}>{year}</option>))}
              </select>
            )}
            {filterPeriod === 'monthly' && (
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="">Select Month</option>
                <option value="0">January</option><option value="1">February</option><option value="2">March</option>
                <option value="3">April</option><option value="4">May</option><option value="5">June</option>
                <option value="6">July</option><option value="7">August</option><option value="8">September</option>
                <option value="9">October</option><option value="10">November</option><option value="11">December</option>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facility</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPayments.length === 0 ? (
                <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">No payments found matching the filters</td></tr>
              ) : (
                filteredPayments.map(payment => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{payment.transactionId || payment.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{payment.user?.name || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{payment.facility?.name || payment.facilityId || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-blue-600 font-semibold">₹{payment.amount || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{payment.method || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatTimestamp(payment.paymentDate)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${payment.status === 'Success' || payment.status === 'completed' ? 'bg-green-100 text-green-800' : payment.status === 'Failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {payment.status === 'completed' ? 'Completed' : payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => openDetailsModal(payment)} className="text-indigo-600 hover:text-indigo-800" title="View Details"><Search size={20} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentDetailsModal isOpen={showDetailsModal} onClose={closeDetailsModal} payment={selectedPaymentDetails} user={selectedPaymentDetails?.user} facility={selectedPaymentDetails?.facility} subscription={selectedPaymentDetails?.subscription} />
    </div>
  );
};

export default PaymentsPage;