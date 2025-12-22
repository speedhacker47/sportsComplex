'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { User, Users, Calendar, AlertCircle, CheckCircle, X, Edit, RefreshCcw } from 'lucide-react';
import { db } from '../../../lib/firebase.js';
import {
  collection, addDoc, getDocs, doc, query, orderBy, Timestamp, getDoc, updateDoc, where, limit
} from 'firebase/firestore';
import SubscriptionExtensionModal from './SubscriptionExtensionModal';
import UserFormModal from './UserFormModal';
import { useAuth } from '@/contexts/AuthContext';
import { calculateEndDate } from './dateUtils'; 

const UserRegistrationPage = () => {
  const { user: staffUser, loading: authLoading, isAdmin } = useAuth();
  const [facilities, setFacilities] = useState([]);
  const [facilitiesMap, setFacilitiesMap] = useState(new Map());
  const [users, setUsers] = useState([]);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Active');
  const [filterFacility, setFilterFacility] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [filterAgeCategory, setFilterAgeCategory] = useState('all');
  const [filterRegistrationType, setFilterRegistrationType] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);  const [selectedUserSubscriptions, setSelectedUserSubscriptions] = useState([]);
  const [selectedUserPayments, setSelectedUserPayments] = useState([]);
  const [selectedFacilityForExtension, setSelectedFacilityForExtension] = useState('');

  const initialFormData = {
    name: '', email: '', mobile: '', dob: '', gender: 'Male',
    fatherName: '', address: '', aadharNo: '', facilityId: '',
    planType: 'oneMonth', startDate: new Date().toISOString().split('T')[0], isRegistration: true,
  };
  const [formData, setFormData] = useState(initialFormData);

  // Load ALL facilities - NO RESTRICTION
  const loadFacilities = useCallback(async () => {
    try {
      const facilitiesRef = collection(db, 'facilities');
      const facilitiesSnap = await getDocs(facilitiesRef);
      const facilitiesDataPromises = facilitiesSnap.docs.map(async (facilityDoc) => {
        const facilityData = { id: facilityDoc.id, ...facilityDoc.data() };
        const feesRef = collection(db, 'facilities', facilityDoc.id, 'fees');
        const feesSnap = await getDocs(feesRef);
        const feesData = {};
        feesSnap.forEach(feeDoc => { feesData[feeDoc.id] = feeDoc.data(); });
        facilityData.fees = feesData;
        return facilityData;
      });
      const facilitiesData = await Promise.all(facilitiesDataPromises);
      const tempFacilitiesMap = new Map();
      facilitiesData.forEach(facility => { tempFacilitiesMap.set(facility.id, facility); });
      setFacilities(facilitiesData);
      setFacilitiesMap(tempFacilitiesMap);
      return tempFacilitiesMap;
    } catch (error) {
      console.error('Error loading facilities:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    if (formData.planType === 'withoutReg') {
      setFormData(prev => ({ ...prev, isRegistration: false }));
    } else {
      setFormData(prev => ({ ...prev, isRegistration: true }));
    }
  }, [formData.planType]);

  const loadUsers = useCallback(async (mapToUse) => {
    if (!mapToUse || mapToUse.size === 0) return;
    try {
        const usersToProcess = new Map();
        const usersQuery = query(collection(db, 'users'));
        const usersSnap = await getDocs(usersQuery);
        usersSnap.forEach(userDoc => usersToProcess.set(userDoc.id, userDoc.data()));

        const enrichedUsersPromises = Array.from(usersToProcess.keys()).map(async (userId) => {
            const userData = usersToProcess.get(userId);
            const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
            const subscriptionsSnap = await getDocs(query(subscriptionsRef, orderBy('createdAt', 'desc')));
            const allSubscriptions = subscriptionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Group by facility - only keep latest per facility
            const facilitySubscriptionsMap = new Map();
            allSubscriptions.forEach(sub => {
              const facilityId = sub.facilityId;
              if (!facilitySubscriptionsMap.has(facilityId)) {
                facilitySubscriptionsMap.set(facilityId, sub);
              }
            });

            let latestSubscription = allSubscriptions.length > 0 ? allSubscriptions[0] : null;
            let primaryFacility = 'N/A';
            let primaryStatus = 'No Subscription';
            let primaryExpiry = 'N/A';

            if (latestSubscription) {
              primaryFacility = mapToUse.get(latestSubscription.facilityId)?.name || 'Unknown';
              if (latestSubscription.endDate instanceof Timestamp) {
                const endDate = latestSubscription.endDate.toDate();
                primaryExpiry = endDate.toLocaleDateString('en-GB');
                const today = new Date();
                const daysUntilExpiry = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                if (daysUntilExpiry < 0) primaryStatus = 'Expired';
                else if (daysUntilExpiry <= 7) primaryStatus = 'Expiring Soon';
                else primaryStatus = 'Active';
              }
            }

            const registrationRef = collection(db, 'users', userId, 'registration');
            const registrationSnap = await getDocs(query(registrationRef, limit(1)));
            const registrationType = !registrationSnap.empty ? 'With Registration' : 'Without Registration';

            const dobParts = userData.dob ? userData.dob.split('/') : ['01', '01', '2000'];
            const dobForInput = `${dobParts[2]}-${dobParts[1]}-${dobParts[0]}`;
            const age = new Date().getFullYear() - parseInt(dobParts[2]);
            const ageCategory = age < 18 ? 'Child' : age < 60 ? 'Adult' : 'Senior';

            return {
                id: userId, ...userData, dobForInput, ageCategory, registrationType,
                expiryDate: primaryExpiry, status: primaryStatus, facility: primaryFacility,
                subscription: latestSubscription, allSubscriptions: allSubscriptions,
            };
        });

        const enrichedUsers = (await Promise.all(enrichedUsersPromises)).filter(Boolean);
        setUsers(enrichedUsers);
    } catch (error) {
        console.error('Error loading users:', error);
        setAlert({ show: true, type: 'error', message: 'Failed to load user data.' });
    }
  }, []);

  useEffect(() => {
    if (!authLoading && staffUser) {
        const loadInitialData = async () => {
            setDataLoading(true);
            try {
                const loadedFacilitiesMap = await loadFacilities();
                await loadUsers(loadedFacilitiesMap);
            } catch (error) {
                console.error('Error during initial data load:', error);
            } finally {
                setDataLoading(false);
            }
        };
        loadInitialData();
    }
  }, [authLoading, staffUser, loadFacilities, loadUsers]);

  const loadUserSubscriptionsAndPayments = async (userId) => {
    const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
    const subscriptionsSnap = await getDocs(query(subscriptionsRef, orderBy('createdAt', 'desc')));
    const subscriptionsData = subscriptionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setSelectedUserSubscriptions(subscriptionsData);

    const paymentsQuery = query(collection(db, 'payments'), where('userId', '==', userId), orderBy('paymentDate', 'desc'));
    const paymentsSnap = await getDocs(paymentsQuery);
    const paymentsData = paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setSelectedUserPayments(paymentsData);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const validateForm = () => {
    const required = ['name', 'mobile', 'dob', 'address', 'aadharNo'];
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
    if (formData.aadharNo.length !== 12) {
      setAlert({ show: true, type: 'error', message: 'Aadhar must be 12 digits' });
      return false;
    }
    if (!showEditModal && !formData.facilityId) {
      setAlert({ show: true, type: 'error', message: 'Please select a facility' });
      return false;
    }
    return true;
  };

  const handleRegisterNewUser = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const now = new Date();
      const registrationDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const dobParts = formData.dob.split('-');
      const formattedDob = `${dobParts[2]}/${dobParts[1]}/${dobParts[0]}`;
      const userData = {
        name: formData.name, email: formData.email || '', mobile: formData.mobile, dob: formattedDob,
        gender: formData.gender, fatherName: formData.fatherName || '', address: formData.address,
        aadharNo: formData.aadharNo, registrationDate: registrationDate,
      };
      const userRef = await addDoc(collection(db, 'users'), userData);

      const selectedFacility = facilities.find(f => f.id === formData.facilityId);
      let paymentAmount = 0;
      if (selectedFacility && selectedFacility.fees) {
        const feeData = selectedFacility.fees[formData.planType];
        if (feeData) {
          paymentAmount = formData.gender === 'Male' ? feeData.priceMale : feeData.priceFemale;
          if (formData.isRegistration && selectedFacility.fees['registration']) {
            const regFee = formData.gender === 'Male' ? selectedFacility.fees['registration'].priceMale : selectedFacility.fees['registration'].priceFemale;
            paymentAmount += regFee;
          }
        }
      }

      const paymentData = {
        userId: userRef.id, amount: paymentAmount, paymentDate: Timestamp.now(),
        status: 'completed', facilityId: formData.facilityId, planType: formData.planType,
      };
      const paymentRef = await addDoc(collection(db, 'payments'), paymentData);

      const feeData = selectedFacility?.fees?.[formData.planType];
      const duration = feeData?.duration || null;
      const startDate = Timestamp.fromDate(new Date(formData.startDate));
      const endDateString = feeData ? calculateEndDate(formData.startDate, formData.planType, duration) : calculateEndDate(formData.startDate, formData.planType, null);
      const endDate = Timestamp.fromDate(new Date(endDateString));

      const subscriptionData = {
        userId: userRef.id, facilityId: formData.facilityId, planType: formData.planType,
        startDate: startDate, endDate: endDate, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), paymentId: paymentRef.id,
      };
      await addDoc(collection(db, 'users', userRef.id, 'subscriptions'), subscriptionData);

      setAlert({ show: true, type: 'success', message: 'User registered successfully!' });
      closeRegistrationModal();
      await loadUsers(facilitiesMap);
    } catch (error) {
      console.error('Error registering user:', error);
      setAlert({ show: true, type: 'error', message: `Registration failed: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      if (!selectedUser) throw new Error("No user selected");
      const dobParts = formData.dob.split('-');
      const formattedDob = `${dobParts[2]}/${dobParts[1]}/${dobParts[0]}`;
      const userDocRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userDocRef, {
        name: formData.name, email: formData.email || '', mobile: formData.mobile, dob: formattedDob,
        gender: formData.gender, fatherName: formData.fatherName || '', address: formData.address,
        aadharNo: formData.aadharNo, lastUpdatedAt: Timestamp.now()
      });
      setAlert({ show: true, type: 'success', message: 'User updated successfully!' });
      closeEditModal();
      await loadUsers(facilitiesMap);
    } catch (error) {
      console.error('Error updating user:', error);
      setAlert({ show: true, type: 'error', message: `Update failed: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const openRegistrationModal = () => {
    setFormData({ ...initialFormData, facilityId: '' });
    setShowRegistrationModal(true);
  };
  const closeRegistrationModal = () => {
    setShowRegistrationModal(false);
    setFormData(initialFormData);
  };
  const openEditModal = async (userToEdit) => {
    setSelectedUser(userToEdit);
    setFormData({
      name: userToEdit.name, email: userToEdit.email, mobile: userToEdit.mobile, dob: userToEdit.dobForInput,
      gender: userToEdit.gender, fatherName: userToEdit.fatherName, address: userToEdit.address,
      aadharNo: userToEdit.aadharNo, facilityId: '', planType: 'oneMonth',
      startDate: new Date().toISOString().split('T')[0],
    });
    await loadUserSubscriptionsAndPayments(userToEdit.id);
    setShowEditModal(true);
  };
  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
    setSelectedUserSubscriptions([]);
    setSelectedUserPayments([]);
    setFormData(initialFormData);
  };
  const openExtensionModal = (facilityId = '') => {
    setSelectedFacilityForExtension(facilityId);
    setShowExtensionModal(true);
  };
  const closeExtensionModal = () => {
    setShowExtensionModal(false);
    setSelectedFacilityForExtension('');
  };
  const handleSubscriptionExtended = async () => {
    await loadUsers(facilitiesMap);
    if (selectedUser) await loadUserSubscriptionsAndPayments(selectedUser.id);
    closeExtensionModal();
  };

  const selectedFacility = facilities.find(f => f.id === formData.facilityId);
  const calculatedFee = !showEditModal && selectedFacility && selectedFacility.fees ? (() => {
    const feeData = selectedFacility.fees[formData.planType];
    if (!feeData) return 0;
    let baseFee = formData.gender === 'Male' ? feeData.priceMale : feeData.priceFemale;
    if (formData.isRegistration && formData.planType !== 'withoutReg' && selectedFacility.fees['registration']) {
      const regFee = formData.gender === 'Male' ? selectedFacility.fees['registration'].priceMale : selectedFacility.fees['registration'].priceFemale;
      baseFee += regFee;
    }
    return baseFee;
  })() : 0;

  const filteredUsers = users.filter(u => {
  const matchesSearch = (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || String(u.mobile || '').includes(searchTerm);
  const matchesFacility = filterFacility === 'all' || u.facility === filterFacility;
  const matchesStatus = filterStatus === 'all' || u.status === filterStatus;
  const matchesGender = filterGender === 'all' || u.gender === filterGender;
  const matchesAgeCategory = filterAgeCategory === 'all' || u.ageCategory === filterAgeCategory;
  const matchesRegistrationType = filterRegistrationType === 'all' || u.registrationType === filterRegistrationType;
  return matchesSearch && matchesFacility && matchesStatus && matchesGender && matchesAgeCategory && matchesRegistrationType;
});

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Users & Registrations</h1>
        <p className="text-gray-600">Manage user registrations and memberships</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Total Users</p><p className="text-2xl font-bold text-gray-900">{users.length}</p></div>
            <Users className="text-blue-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Active</p><p className="text-2xl font-bold text-green-600">{users.filter(u => u.status === 'Active').length}</p></div>
            <CheckCircle className="text-green-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Expired</p><p className="text-2xl font-bold text-red-600">{users.filter(u => u.status === 'Expired').length}</p></div>
            <AlertCircle className="text-red-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-600">Expiring Soon</p><p className="text-2xl font-bold text-orange-600">{users.filter(u => u.status === 'Expiring Soon').length}</p></div>
            <Calendar className="text-orange-500" size={32} />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 flex-1 flex-wrap">
            <input type="text" placeholder="Search by user name or mobile..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <select value={filterFacility} onChange={(e) => setFilterFacility(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="all">All Sports</option>
              <option value="N/A">No Subscription</option>
              {facilities.map(f => (<option key={f.id} value={f.name}>{f.name}</option>))}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Expired">Expired</option>
              <option value="Expiring Soon">Expiring Soon</option>
              <option value="No Subscription">No Subscription</option>
            </select>
            <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <select value={filterAgeCategory} onChange={(e) => setFilterAgeCategory(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="all">All Ages</option>
              <option value="Child">Child</option>
              <option value="Adult">Adult</option>
              <option value="Senior">Senior</option>
            </select>
            <select value={filterRegistrationType} onChange={(e) => setFilterRegistrationType(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="all">All Types</option>
              <option value="With Registration">With Registration</option>
              <option value="Without Registration">Without Registration</option>
            </select>
          </div>
          <button onClick={openRegistrationModal} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <User size={18} />Register New User
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gender</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Age Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registration Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registration Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facility</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr><td colSpan="9" className="px-6 py-8 text-center text-gray-500">No users found</td></tr>
              ) : (
                filteredUsers.map(userItem => (
                  <tr key={userItem.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{userItem.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{userItem.gender}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{userItem.ageCategory}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{userItem.registrationType}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{userItem.registrationDate ? new Date(userItem.registrationDate.split(' ')[0].split('/').reverse().join('-')).toLocaleDateString('en-GB') : 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{userItem.facility}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{userItem.expiryDate}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${userItem.status === 'Active' ? 'bg-green-100 text-green-800' : userItem.status === 'Expired' ? 'bg-red-100 text-red-800' : userItem.status === 'Expiring Soon' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                        {userItem.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-4">
                        <button onClick={() => openEditModal(userItem)} className="text-indigo-600 hover:text-indigo-800" title="Edit"><Edit size={20} /></button>
                        <button onClick={() => { setSelectedUser(userItem); loadUserSubscriptionsAndPayments(userItem.id); openExtensionModal(''); }} className="text-blue-600 hover:text-blue-800" title="Extend"><RefreshCcw size={20} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserFormModal isOpen={showRegistrationModal} onClose={closeRegistrationModal} formData={formData} handleInputChange={handleInputChange} handleSubmit={handleRegisterNewUser} loading={loading} facilities={facilities} selectedFacility={selectedFacility} calculatedFee={calculatedFee} isEditMode={false} staffUser={staffUser} isAdmin={isAdmin} />

      <UserFormModal isOpen={showEditModal} onClose={closeEditModal} formData={formData} handleInputChange={handleInputChange} handleSubmit={handleUpdateUser} loading={loading} facilities={facilities} selectedFacility={selectedFacility} calculatedFee={0} isEditMode={true} selectedUser={selectedUser} userSubscriptions={selectedUserSubscriptions} userPayments={selectedUserPayments} onExtendSubscriptionClick={() => openExtensionModal()} staffUser={staffUser} isAdmin={isAdmin} />

      {selectedUser && (
        <SubscriptionExtensionModal isOpen={showExtensionModal} onClose={closeExtensionModal} memberUser={selectedUser} facilities={facilities} onSubscriptionExtended={handleSubscriptionExtended} setAlert={setAlert} user={staffUser} isAdmin={isAdmin} selectedFacilityId={selectedFacilityForExtension} />
      )}
    </div>
  );
};

export default UserRegistrationPage;