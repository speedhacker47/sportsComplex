'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Calendar, AlertCircle, CheckCircle, X, Edit, RefreshCcw, Trash2, IndianRupee, AlertTriangle, Loader2 } from 'lucide-react';
import { db } from '../../../lib/firebase.js';
import {
  collection, addDoc, getDocs, doc, query, orderBy, Timestamp, updateDoc, where, limit, deleteDoc
} from 'firebase/firestore';
import AcademyFormModal from './AcademyFormModal.js';
import AcademyExtensionModal from './AcademyExtensionModal.js';
import PaymentReceiptModal from './PaymentReceiptModal'; // Ensure this path is correct
import { useAuth } from '@/contexts/AuthContext';

const AcademyManagementPage = () => {
  const { user: staffUser, loading: authLoading } = useAuth();
  
  const [academies, setAcademies] = useState([]);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Selected Data State
  const [selectedAcademy, setSelectedAcademy] = useState(null);
  const [selectedAcademySubscriptions, setSelectedAcademySubscriptions] = useState([]);
  const [selectedAcademyPayments, setSelectedAcademyPayments] = useState([]);

  // Duplicate Check State
  const [duplicateWarning, setDuplicateWarning] = useState({ show: false, academy: null });

  // Receipt State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);

  const initialFormData = {
    name: '',
    email: '',
    mobile: '',
    address: '',
    monthlyPrice: '',
    startDate: new Date().toISOString().split('T')[0],
  };
  const [formData, setFormData] = useState(initialFormData);

  // Load Academies Function
  const loadAcademies = useCallback(async () => {
    try {
      const academiesQuery = query(collection(db, 'academies'), orderBy('registrationDate', 'desc'));
      const academiesSnap = await getDocs(academiesQuery);
      
      const enrichedAcademiesPromises = academiesSnap.docs.map(async (academyDoc) => {
        const academyData = { id: academyDoc.id, ...academyDoc.data() };
        
        // Get latest subscription
        const subscriptionsRef = collection(db, 'academies', academyDoc.id, 'subscriptions');
        const subscriptionsSnap = await getDocs(query(subscriptionsRef, orderBy('createdAt', 'desc'), limit(1)));
        
        let status = 'Inactive';
        let expiryDate = 'N/A';
        let subscription = null;

        if (!subscriptionsSnap.empty) {
          subscription = { id: subscriptionsSnap.docs[0].id, ...subscriptionsSnap.docs[0].data() };
          if (subscription.endDate instanceof Timestamp) {
            const endDate = subscription.endDate.toDate();
            expiryDate = endDate.toLocaleDateString('en-GB');
            const today = new Date();
            const daysUntilExpiry = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry < 0) status = 'Expired';
            else if (daysUntilExpiry <= 7) status = 'Expiring Soon';
            else status = 'Active';
          }
        }

        return {
          ...academyData,
          status,
          expiryDate,
          subscription,
        };
      });

      const enrichedAcademies = await Promise.all(enrichedAcademiesPromises);
      setAcademies(enrichedAcademies);
    } catch (error) {
      console.error('Error loading academies:', error);
      setAlert({ show: true, type: 'error', message: 'Failed to load academies.' });
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (staffUser) {
      const loadInitialData = async () => {
        setDataLoading(true);
        try {
          await loadAcademies();
        } catch (error) {
          console.error('Error during initial data load:', error);
        } finally {
          setDataLoading(false);
        }
      };
      loadInitialData();
    } else {
      setDataLoading(false);
    }
  }, [authLoading, staffUser, loadAcademies]);

  const loadAcademySubscriptionsAndPayments = async (academyId) => {
    const subscriptionsRef = collection(db, 'academies', academyId, 'subscriptions');
    const subscriptionsSnap = await getDocs(query(subscriptionsRef, orderBy('createdAt', 'desc')));
    const subscriptionsData = subscriptionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setSelectedAcademySubscriptions(subscriptionsData);

    const paymentsQuery = query(
      collection(db, 'payments'),
      where('payments', '==', academyId),
      orderBy('paymentDate', 'desc')
    );
    const paymentsSnap = await getDocs(paymentsQuery);
    const paymentsData = paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setSelectedAcademyPayments(paymentsData);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const required = ['name', 'mobile', 'address', 'monthlyPrice'];
    for (let field of required) {
      if (!formData[field]) {
        setAlert({ show: true, type: 'error', message: `Please fill in ${field}` });
        return false;
      }
    }
    if (formData.mobile.length !== 10) {
      setAlert({ show: true, type: 'error', message: 'Mobile must be 10 digits' });
      return false;
    }
    if (isNaN(formData.monthlyPrice) || parseFloat(formData.monthlyPrice) <= 0) {
      setAlert({ show: true, type: 'error', message: 'Please enter a valid monthly price' });
      return false;
    }
    return true;
  };

  // REGISTER NEW ACADEMY
  const handleRegisterNewAcademy = async () => {
    if (!validateForm()) return;

    // 1. Check for Duplicates
    const duplicate = academies.find(a => a.mobile === formData.mobile || (a.email && a.email === formData.email));
    if (duplicate) {
      setDuplicateWarning({ show: true, academy: duplicate });
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const registrationDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      
      const academyData = {
        name: formData.name,
        email: formData.email || '',
        mobile: formData.mobile,
        address: formData.address,
        monthlyPrice: parseFloat(formData.monthlyPrice),
        registrationDate: registrationDate,
        createdBy: staffUser.uid,
      };
      await addDoc(collection(db, 'academies'), academyData);

      setAlert({ show: true, type: 'success', message: 'Academy registered successfully! Now add subscription using Extend Subscription.' });
      closeRegistrationModal();
      await loadAcademies();
    } catch (error) {
      console.error('Error registering academy:', error);
      setAlert({ show: true, type: 'error', message: `Registration failed: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAcademy = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      if (!selectedAcademy) throw new Error("No academy selected");
      
      const academyDocRef = doc(db, 'academies', selectedAcademy.id);
      await updateDoc(academyDocRef, {
        name: formData.name,
        email: formData.email || '',
        mobile: formData.mobile,
        address: formData.address,
        monthlyPrice: parseFloat(formData.monthlyPrice),
        lastUpdatedAt: Timestamp.now(),
        lastUpdatedBy: staffUser.uid,
      });
      
      setAlert({ show: true, type: 'success', message: 'Academy updated successfully!' });
      closeEditModal();
      await loadAcademies();
    } catch (error) {
      console.error('Error updating academy:', error);
      setAlert({ show: true, type: 'error', message: `Update failed: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAcademy = async (academy) => {
    if (!window.confirm(`Are you sure you want to delete ${academy.name}? This action cannot be undone.`)) {
      return;
    }
    setLoading(true);
    try {
      // Delete subscriptions
      const subscriptionsRef = collection(db, 'academies', academy.id, 'subscriptions');
      const subscriptionsSnap = await getDocs(subscriptionsRef);
      const deleteSubscriptionsPromises = subscriptionsSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteSubscriptionsPromises);

      // Delete payments
      const paymentsQuery = query(collection(db, 'payments'), where('academyId', '==', academy.id));
      const paymentsSnap = await getDocs(paymentsQuery);
      const deletePaymentsPromises = paymentsSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePaymentsPromises);

      // Delete academy
      await deleteDoc(doc(db, 'academies', academy.id));

      setAlert({ show: true, type: 'success', message: 'Academy deleted successfully!' });
      await loadAcademies();
    } catch (error) {
      console.error('Error deleting academy:', error);
      setAlert({ show: true, type: 'error', message: `Delete failed: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const openRegistrationModal = () => {
    setFormData(initialFormData);
    setShowRegistrationModal(true);
  };

  const closeRegistrationModal = () => {
    setShowRegistrationModal(false);
    setFormData(initialFormData);
  };

  const openEditModal = async (academy) => {
    setSelectedAcademy(academy);
    setFormData({
      name: academy.name,
      email: academy.email || '',
      mobile: academy.mobile,
      address: academy.address,
      monthlyPrice: academy.monthlyPrice.toString(),
      startDate: new Date().toISOString().split('T')[0],
    });
    await loadAcademySubscriptionsAndPayments(academy.id);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedAcademy(null);
    setSelectedAcademySubscriptions([]);
    setSelectedAcademyPayments([]);
    setFormData(initialFormData);
  };

  const openExtensionModal = (academy) => {
    setSelectedAcademy(academy);
    loadAcademySubscriptionsAndPayments(academy.id);
    setShowExtensionModal(true);
  };

  const closeExtensionModal = () => {
    setShowExtensionModal(false);
    setSelectedAcademy(null);
  };

  // Handle Successful Extension
  const handleSubscriptionExtended = async (receiptInfo) => {
    closeExtensionModal();
    
    // Show receipt
    if (receiptInfo) {
      setReceiptData(receiptInfo);
      setShowReceiptModal(true);
    }

    // Refresh Data
    await loadAcademies();
    if (selectedAcademy) await loadAcademySubscriptionsAndPayments(selectedAcademy.id);
  };

  const filteredAcademies = academies.filter(academy => {
    const matchesSearch = 
      (academy.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      String(academy.mobile || '').includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || academy.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-600 mx-auto" size={48} />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {alert.show && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
          alert.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {alert.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{alert.message}</span>
          <button onClick={() => setAlert({ show: false, type: '', message: '' })}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Generating Receipt Overlay (Optional if you want it during registration too) */}
      {isGeneratingReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
          <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
            <Loader2 className="animate-spin text-blue-600 mb-3" size={32} />
            <p className="text-gray-900 font-semibold text-lg">Processing...</p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Other Facility Management</h1>
        <p className="text-gray-600">Manage academy registrations and subscriptions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* ... (Existing Stats Cards) ... */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Academies</p>
              <p className="text-2xl font-bold text-gray-900">{academies.length}</p>
            </div>
            <Building2 className="text-blue-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-600">{academies.filter(a => a.status === 'Active').length}</p>
            </div>
            <CheckCircle className="text-green-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inactive</p>
              <p className="text-2xl font-bold text-gray-600">{academies.filter(a => a.status === 'Inactive').length}</p>
            </div>
            <AlertCircle className="text-gray-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-bold text-orange-600">{academies.filter(a => a.status === 'Expiring Soon').length}</p>
            </div>
            <Calendar className="text-orange-500" size={32} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 flex-1 flex-wrap">
            <input
              type="text"
              placeholder="Search by academy name or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Expired">Expired</option>
              <option value="Expiring Soon">Expiring Soon</option>
            </select>
          </div>
          <button
            onClick={openRegistrationModal}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Building2 size={18} />
            Register Other Facility
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Academy Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mobile</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monthly Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAcademies.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No academies found
                  </td>
                </tr>
              ) : (
                filteredAcademies.map(academy => (
                  <tr key={academy.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{academy.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{academy.mobile}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{academy.email || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-semibold">
                      <div className="flex items-center">
                        <IndianRupee size={14} className="mr-1" />
                        {academy.monthlyPrice}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{academy.expiryDate}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        academy.status === 'Active' ? 'bg-green-100 text-green-800' :
                        academy.status === 'Inactive' ? 'bg-gray-100 text-gray-800' :
                        academy.status === 'Expired' ? 'bg-red-100 text-red-800' :
                        academy.status === 'Expiring Soon' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {academy.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
                        <button onClick={() => openEditModal(academy)} className="text-indigo-600 hover:text-indigo-800" title="Edit">
                          <Edit size={20} />
                        </button>
                        <button onClick={() => openExtensionModal(academy)} className="text-blue-600 hover:text-blue-800" title="Extend Subscription">
                          <RefreshCcw size={20} />
                        </button>
                        <button onClick={() => handleDeleteAcademy(academy)} className="text-red-600 hover:text-red-800" title="Delete">
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AcademyFormModal
        isOpen={showRegistrationModal}
        onClose={closeRegistrationModal}
        formData={formData}
        handleInputChange={handleInputChange}
        handleSubmit={handleRegisterNewAcademy}
        loading={loading}
        isEditMode={false}
      />

      <AcademyFormModal
        isOpen={showEditModal}
        onClose={closeEditModal}
        formData={formData}
        handleInputChange={handleInputChange}
        handleSubmit={handleUpdateAcademy}
        loading={loading}
        isEditMode={true}
        selectedAcademy={selectedAcademy}
        academySubscriptions={selectedAcademySubscriptions}
        academyPayments={selectedAcademyPayments}
        onExtendSubscriptionClick={() => {
          closeEditModal();
          openExtensionModal(selectedAcademy);
        }}
      />

      {/* DUPLICATE WARNING MODAL */}
      {duplicateWarning.show && duplicateWarning.academy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex flex-col items-center text-center">
              <div className="bg-orange-100 p-3 rounded-full mb-4">
                <AlertTriangle className="text-orange-600 w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Facility Already Exists</h3>
              <p className="text-gray-600 mb-6">A facility with this mobile number or email already exists.</p>
              
              <div className="bg-gray-50 rounded-lg p-4 w-full mb-6 border border-gray-200 text-left">
                <p className="text-sm text-gray-500 mb-1">Existing Details:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-semibold text-gray-700">Name:</span>
                  <span>{duplicateWarning.academy.name}</span>
                  <span className="font-semibold text-gray-700">Mobile:</span>
                  <span>{duplicateWarning.academy.mobile}</span>
                </div>
              </div>

              <div className="flex flex-col w-full gap-3">
                <button 
                  onClick={() => setDuplicateWarning({ show: false, academy: null })}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Edit New Facility Details
                </button>
                <button 
                  onClick={() => {
                    setDuplicateWarning({ show: false, academy: null });
                    closeRegistrationModal();
                  }} 
                  className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel Registration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedAcademy && (
        <AcademyExtensionModal
          isOpen={showExtensionModal}
          onClose={closeExtensionModal}
          academy={selectedAcademy}
          onSubscriptionExtended={handleSubscriptionExtended}
          setAlert={setAlert}
          staffUser={staffUser}
        />
      )}

      {/* PAYMENT RECEIPT MODAL */}
      <PaymentReceiptModal 
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        data={receiptData}
      />

    </div>
  );
};

export default AcademyManagementPage;