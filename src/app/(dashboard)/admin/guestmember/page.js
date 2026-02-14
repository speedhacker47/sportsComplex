'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { User, Users, Search, AlertCircle, CheckCircle, X, PlusCircle, RefreshCcw, Loader2 } from 'lucide-react';
import { db } from '../../../lib/firebase.js';
import {
  collection, addDoc, getDocs, doc, query, orderBy, Timestamp, runTransaction, where
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import GuestFormModal from './GuestFormModal';
import PaymentReceiptModal from './PaymentReceiptModal';

// Inline Date Calculation Utility to prevent import errors
const calculateEndDate = (startDate, planType, duration) => {
    if (!startDate) return new Date().toISOString().split('T')[0];
    
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return new Date().toISOString().split('T')[0]; // Safety check

    let end = new Date(start);

    // Priority 1: Use specific duration from database if available
    if (duration && !isNaN(duration)) {
        end.setMonth(end.getMonth() + parseInt(duration));
    } 
    // Priority 2: Infer from Plan Type Name
    else {
        const lowerPlan = planType ? planType.toLowerCase() : '';
        
        if (lowerPlan.includes('onemonth') || lowerPlan.includes('monthly')) {
            end.setMonth(end.getMonth() + 1);
        } else if (lowerPlan.includes('threemonth') || lowerPlan.includes('quarterly')) {
            end.setMonth(end.getMonth() + 3);
        } else if (lowerPlan.includes('sixmonth') || lowerPlan.includes('half')) {
            end.setMonth(end.getMonth() + 6);
        } else if (lowerPlan.includes('year') || lowerPlan.includes('annual')) {
            end.setFullYear(end.getFullYear() + 1);
        } else if (lowerPlan.includes('daily')) {
            end.setDate(end.getDate() + 1);
        } else {
            // Default Fallback
            end.setMonth(end.getMonth() + 1);
        }
    }

    return end.toISOString().split('T')[0];
};

const GuestRegistrationPage = () => {
  const { user: staffUser, loading: authLoading } = useAuth();
  
  // Data State
  const [facilities, setFacilities] = useState([]);
  const [guests, setGuests] = useState([]);
  
  // UI State
  const [showModal, setShowModal] = useState(false);
  const [isExistingGuestMode, setIsExistingGuestMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFacilityFilter, setSelectedFacilityFilter] = useState('all'); // NEW: Facility Filter
  const [filterStatus, setFilterStatus] = useState('all'); // NEW: Status Filter (all, active, inactive)
  
  // QR Codes
  const [qrCodes, setQrCodes] = useState([]);

  // Receipt
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // Form Data
  const initialFormData = {
    name: '', 
    mobile: '', 
    facilityId: '',
    planType: '', 
    startDate: new Date().toISOString().split('T')[0],
    utrNumber: '', 
    qrCodeId: '',
    guestId: null 
  };
  const [formData, setFormData] = useState(initialFormData);

  // --- 1. Load Data ---

  // Load Facilities
  const loadFacilities = useCallback(async () => {
    try {
      const facilitiesRef = collection(db, 'facilities');
      const facilitiesSnap = await getDocs(facilitiesRef);
      const facilitiesData = await Promise.all(facilitiesSnap.docs.map(async (doc) => {
        const data = { id: doc.id, ...doc.data() };
        // Fetch fees subcollection
        const feesSnap = await getDocs(collection(db, 'facilities', doc.id, 'fees'));
        const fees = {};
        feesSnap.forEach(f => fees[f.id] = f.data());
        data.fees = fees;
        return data;
      }));
      setFacilities(facilitiesData);
      return facilitiesData;
    } catch (error) {
      console.error('Error loading facilities:', error);
    }
  }, []);

  // Load Guests (Flattened with latest subscription)
  const loadGuests = useCallback(async (facilitiesList) => {
    try {
      const guestsRef = collection(db, 'guests');
      const guestsSnap = await getDocs(query(guestsRef, orderBy('lastVisit', 'desc')));
      
      const guestList = await Promise.all(guestsSnap.docs.map(async (guestDoc) => {
        const guest = { id: guestDoc.id, ...guestDoc.data() };
        
        // Fetch Subscriptions for this guest
        const subsRef = collection(db, 'guests', guestDoc.id, 'subscriptions');
        const subsSnap = await getDocs(query(subsRef, orderBy('createdAt', 'desc')));
        
        // Get active/latest sub
        const subs = subsSnap.docs.map(s => s.data());
        const latestSub = subs.length > 0 ? subs[0] : null;
        
        // Enrich with Facility Name
        let currentFacilityName = '-';
        let isActive = false;

        if (latestSub) {
          const fac = facilitiesList.find(f => f.id === latestSub.facilityId);
          currentFacilityName = fac ? fac.name : 'Unknown';
          
          if (latestSub.endDate) {
             const endDate = latestSub.endDate.toDate();
             const today = new Date();
             if (endDate >= today) isActive = true;
          }
        }

        return {
          ...guest,
          latestSub,
          currentFacilityName,
          isActive
        };
      }));

      setGuests(guestList);
    } catch (error) {
      console.error("Error loading guests:", error);
    }
  }, []);

  // Load QR Codes
  const loadQRCodes = async () => {
    const qrSnap = await getDocs(collection(db, 'qrCodes'));
    setQrCodes(qrSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    if (!authLoading && staffUser) {
      const init = async () => {
        setDataLoading(true);
        const facs = await loadFacilities();
        await loadGuests(facs);
        await loadQRCodes();
        setDataLoading(false);
      };
      init();
    }
  }, [authLoading, staffUser, loadFacilities, loadGuests]);


  // --- 2. Form Handlers ---

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openNewGuestModal = () => {
    setIsExistingGuestMode(false);
    setFormData(initialFormData);
    setShowModal(true);
  };

  const openNewBookingModal = (guest) => {
    setIsExistingGuestMode(true);
    setFormData({
      ...initialFormData,
      name: guest.name,
      mobile: guest.mobile,
      guestId: guest.id
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData(initialFormData);
  };

  // --- 3. Calculation & Logic ---

  const selectedFacility = facilities.find(f => f.id === formData.facilityId);
  
  // Logic to auto-detect price based on plan name since gender is implicit in plan
  const calculatedFee = selectedFacility && formData.planType && selectedFacility.fees[formData.planType] 
    ? (selectedFacility.fees[formData.planType].priceMale || selectedFacility.fees[formData.planType].priceFemale || selectedFacility.fees[formData.planType].price || 0)
    : 0;

  const handleSubmit = async () => {
    // Basic Validation
    if (!formData.name || !formData.mobile || !formData.facilityId || !formData.utrNumber || !formData.qrCodeId) {
      setAlert({ show: true, type: 'error', message: 'Please fill all fields' });
      return;
    }
    if (formData.mobile.length !== 10) {
      setAlert({ show: true, type: 'error', message: 'Invalid mobile number' });
      return;
    }

    setLoading(true);
    setIsGeneratingReceipt(true);

    try {
      let guestId = formData.guestId;

      // 1. If New Guest -> Create Guest Doc
      if (!isExistingGuestMode) {
        // Check duplicate mobile in guests collection
        const q = query(collection(db, 'guests'), where('mobile', '==', formData.mobile));
        const snap = await getDocs(q);
        if (!snap.empty) {
          throw new Error("Guest with this mobile number already exists.");
        }

        const newGuest = await addDoc(collection(db, 'guests'), {
          name: formData.name,
          mobile: formData.mobile,
          createdAt: Timestamp.now(),
          lastVisit: Timestamp.now(),
          createdBy: staffUser.uid || 'system'
        });
        guestId = newGuest.id;
      } else {
        // Update last visit
        await runTransaction(db, async(transaction) => {
           transaction.update(doc(db, 'guests', guestId), { lastVisit: Timestamp.now() });
        });
      }

      // 2. Generate Invoice #
      const paymentInfoRef = doc(db, 'payments', '000info');
      let nextInvoiceNo = '';
      
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(paymentInfoRef);
        let lastInvoice = 0;
        if (docSnap.exists()) {
             lastInvoice = docSnap.data().lastInvoice || 0;
        } else {
             transaction.set(paymentInfoRef, { lastInvoice: 0 });
        }
        
        const nextNum = lastInvoice + 1;
        transaction.update(paymentInfoRef, { lastInvoice: nextNum });
        nextInvoiceNo = `INV${new Date().getFullYear()}${String(nextNum).padStart(5, '0')}`;
      });

      // 3. Create Payment Record
      const qrName = qrCodes.find(q => q.id === formData.qrCodeId)?.name || 'Unknown';
      const paymentData = {
        userId: guestId, // Using guest ID here
        isGuest: true, 
        amount: calculatedFee,
        paymentDate: Timestamp.now(),
        method: 'Online',
        transactionId: formData.utrNumber.trim(),
        qrCodeName: qrName,
        facilityId: formData.facilityId,
        planType: formData.planType,
        invoiceNumber: nextInvoiceNo,
        status: 'pending'
      };
      const paymentRef = await addDoc(collection(db, 'payments'), paymentData);

      // 4. Create Subscription 
      const feeData = selectedFacility.fees[formData.planType] || {};
      // Safe calculation logic
      const endDateStr = calculateEndDate(formData.startDate, formData.planType, feeData.duration);
      
      const subData = {
        facilityId: formData.facilityId,
        planType: formData.planType,
        startDate: Timestamp.fromDate(new Date(formData.startDate)),
        endDate: Timestamp.fromDate(new Date(endDateStr)),
        paymentId: paymentRef.id,
        createdAt: Timestamp.now(),
        status: 'active'
      };
      await addDoc(collection(db, 'guests', guestId, 'subscriptions'), subData);

      // 5. Success & Receipt
      setAlert({ show: true, type: 'success', message: 'Guest booking successful!' });
      
      setReceiptData({
        paymentId: paymentRef.id,
        transactionId: formData.utrNumber,
        paymentDate: new Date().toLocaleDateString('en-GB'),
        userName: formData.name + " (Guest)",
        regNumber: "GUEST",
        facilityName: selectedFacility.name,
        planType: formData.planType,
        amount: calculatedFee,
        status: 'pending',
        invoiceNo: nextInvoiceNo
      });

      setShowReceiptModal(true);
      closeModal();
      await loadGuests(facilities);

    } catch (error) {
      console.error(error);
      setAlert({ show: true, type: 'error', message: error.message });
    } finally {
      setLoading(false);
      setIsGeneratingReceipt(false);
    }
  };

  // --- 4. Filtering Logic ---
  const filteredGuests = guests.filter(g => {
    const searchLower = searchTerm.toLowerCase();
    
    // 1. Search (Name or Mobile)
    const matchesSearch = 
        g.name.toLowerCase().includes(searchLower) || 
        g.mobile.includes(searchTerm);
    if (!matchesSearch) return false;

    // 2. Facility Filter
    if (selectedFacilityFilter !== 'all') {
        // Check if their latest subscription matches the selected facility
        if (g.latestSub?.facilityId !== selectedFacilityFilter) return false;
    }

    // 3. Status Filter
    if (filterStatus === 'active') {
        if (!g.isActive) return false;
    } else if (filterStatus === 'inactive') {
        if (g.isActive) return false;
    }

    return true;
  });

  if (authLoading || dataLoading) {
     return <div className="min-h-screen flex items-center justify-center bg-gray-50">
         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
     </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Alert */}
      {alert.show && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${alert.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {alert.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{alert.message}</span>
          <button onClick={() => setAlert({ show: false, type: '', message: '' })}><X size={18} /></button>
        </div>
      )}

      {/* Loading Overlay */}
      {isGeneratingReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
          <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
            <Loader2 className="animate-spin text-blue-600 mb-3" size={32} />
            <p className="text-gray-900 font-semibold">Processing Guest Booking...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Guest Users</h1>
          <p className="text-gray-600">Manage daily passes and guest bookings</p>
        </div>
      </div>

      {/* Stats - Now Responsive to Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
           <div><p className="text-sm text-gray-600">Total Guests</p><p className="text-2xl font-bold text-gray-900">{filteredGuests.length}</p></div>
           <Users className="text-blue-500" size={32} />
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
           <div><p className="text-sm text-gray-600">Active Now</p><p className="text-2xl font-bold text-green-600">{filteredGuests.filter(g => g.isActive).length}</p></div>
           <CheckCircle className="text-green-500" size={32} />
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
           <div><p className="text-sm text-gray-600">Inactive</p><p className="text-2xl font-bold text-gray-500">{filteredGuests.filter(g => !g.isActive).length}</p></div>
           <AlertCircle className="text-gray-400" size={32} />
        </div>
      </div>

      {/* Action Bar & Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search guest name or mobile..." 
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Facility Filter */}
            <select
                value={selectedFacilityFilter}
                onChange={(e) => setSelectedFacilityFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
                <option value="all">All Facilities</option>
                {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                ))}
            </select>

            {/* Status Filter */}
            <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
                <option value="all">All Status</option>
                <option value="active">Active Now</option>
                <option value="inactive">Inactive</option>
            </select>

            {/* Add Button */}
            <button onClick={openNewGuestModal} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                <PlusCircle size={18} /> New Guest
            </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mobile</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latest Facility</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Visit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredGuests.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-500">No guests found</td></tr>
              ) : (
                filteredGuests.map(guest => (
                  <tr key={guest.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{guest.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{guest.mobile}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{guest.currentFacilityName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${guest.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {guest.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {guest.lastVisit ? new Date(guest.lastVisit.toDate()).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => openNewBookingModal(guest)}
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium"
                      >
                        <RefreshCcw size={16} /> New Booking
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      <GuestFormModal 
        isOpen={showModal}
        onClose={closeModal}
        formData={formData}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        loading={loading}
        facilities={facilities}
        selectedFacility={selectedFacility}
        calculatedFee={calculatedFee}
        qrCodes={qrCodes}
        isExistingGuest={isExistingGuestMode}
      />

      {/* Receipt Modal */}
      <PaymentReceiptModal 
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        data={receiptData}
      />

    </div>
  );
};

export default GuestRegistrationPage;