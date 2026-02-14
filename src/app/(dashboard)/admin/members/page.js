'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { User, Users, Calendar, AlertCircle, CheckCircle, X, Edit, RefreshCcw, QrCode, Trash2, Upload, Loader2, AlertTriangle, FileDown, Download } from 'lucide-react';
import { db, storage } from '../../../lib/firebase.js'; 
import {
  collection, addDoc, getDocs, doc, query, orderBy, Timestamp, getDoc, updateDoc, where, limit, deleteDoc, runTransaction
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import SubscriptionExtensionModal from './SubscriptionExtensionModal';
import UserFormModal from './UserFormModal';
import PaymentReceiptModal from './PaymentReceiptModal';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx'; // Added for Excel Export

const UserRegistrationPage = () => {
  const { user: staffUser, loading: authLoading, isAdmin } = useAuth();
  
  // Existing State
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
  const [selectedFacilityFilter, setSelectedFacilityFilter] = useState(''); 
  const [filterExpiryStatus, setFilterExpiryStatus] = useState('all'); 
  const [filterAgeCategory, setFilterAgeCategory] = useState('all'); 
  const [filterGender, setFilterGender] = useState('all');
  
  // Export State
  const [exportLoading, setExportLoading] = useState(false);

  // Selected User State
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserSubscriptions, setSelectedUserSubscriptions] = useState([]);
  const [selectedUserPayments, setSelectedUserPayments] = useState([]);
  const [selectedFacilityForExtension, setSelectedFacilityForExtension] = useState('');

  // Duplicate Check State
  const [duplicateWarning, setDuplicateWarning] = useState({ show: false, user: null });

  // Receipt State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false); 

  // QR CODE STATE
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodes, setQrCodes] = useState([]);
  const [qrName, setQrName] = useState('');
  const [qrFile, setQrFile] = useState(null);
  const [qrUploading, setQrUploading] = useState(false);

  const initialFormData = {
    name: '', email: '', mobile: '', dob: '', gender: 'Male',
    fatherName: '', address: '', aadharNo: '', facilityId: '',
    planType: 'oneMonth', startDate: new Date().toISOString().split('T')[0], isRegistration: true,
    utrNumber: '', qrCodeId: ''
  };
  const [formData, setFormData] = useState(initialFormData);

  // --- DELETE USER FUNCTION ---
  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to permanently delete this user? This action cannot be undone.")) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', userId));
      setAlert({ show: true, type: 'success', message: 'User deleted successfully.' });
      await loadUsers(facilitiesMap);
    } catch (error) {
      console.error('Error deleting user:', error);
      setAlert({ show: true, type: 'error', message: `Failed to delete user: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Load Facilities
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

  // Load Users with NEW TABLE STRUCTURE
  const loadUsers = useCallback(async (mapToUse) => {
  // REMOVED THE BLOCKING IF STATEMENT
  // if (!mapToUse || mapToUse.size === 0) return; 

  // Add this safety check instead so the code doesn't crash if map is null
  const facilityMap = mapToUse || new Map(); 
    try {
      const usersQuery = query(collection(db, 'users'));
      const usersSnap = await getDocs(usersQuery);
      
      const enrichedUsersPromises = usersSnap.docs
        .filter(doc => doc.id !== '000info') 
        .map(async (userDoc) => {
        const userData = userDoc.data();
        const userId = userDoc.id;

        const subscriptionsRef = collection(db, 'users', userId, 'subscriptions');
        const subscriptionsSnap = await getDocs(query(subscriptionsRef, orderBy('createdAt', 'desc')));
        const allSubscriptions = subscriptionsSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));

        const facilitySubscriptionsMap = new Map();
        allSubscriptions.forEach(sub => {
          const facilityId = sub.facilityId;
          if (!facilitySubscriptionsMap.has(facilityId)) {
            facilitySubscriptionsMap.set(facilityId, sub);
          }
        });

        const today = new Date();
        const activeSubscriptions = [];
        const expiredSubscriptions = [];

        facilitySubscriptionsMap.forEach((sub, facilityId) => {
          const facilityName = facilityMap.get(facilityId)?.name || 'Unknown';
          const endDate = sub.endDate instanceof Timestamp ? sub.endDate.toDate() : new Date(sub.endDate);
          const isActive = endDate >= today;
          
          const subInfo = {
            facilityId,
            facilityName,
            endDate,
            endDateStr: endDate.toLocaleDateString('en-GB'),
            isActive
          };

          if (isActive) {
            activeSubscriptions.push(subInfo);
          } else {
            expiredSubscriptions.push(subInfo);
          }
        });

        activeSubscriptions.sort((a, b) => b.endDate - a.endDate);
        expiredSubscriptions.sort((a, b) => b.endDate - a.endDate);

        const displaySubscriptions = activeSubscriptions.length > 0 
          ? activeSubscriptions 
          : expiredSubscriptions.slice(0, 1);

        let registrationExpiry = 'N/A';
        if (activeSubscriptions.length > 0) {
          const longestExpiry = activeSubscriptions[0].endDate;
          const regExpiryDate = new Date(longestExpiry);
          regExpiryDate.setMonth(regExpiryDate.getMonth() + 6);
          registrationExpiry = regExpiryDate.toLocaleDateString('en-GB');
        } else if (expiredSubscriptions.length > 0) {
          registrationExpiry = 'Expired';
        }

        const dobParts = userData.dob ? userData.dob.split('/') : ['01', '01', '2000'];
        const dobForInput = `${dobParts[2]}-${dobParts[1]}-${dobParts[0]}`;
        const age = new Date().getFullYear() - parseInt(dobParts[2]);
        const ageCategory = age < 18 ? 'Child' : age < 60 ? 'Adult' : 'Senior';

        return {
          id: userId,
          regNumber: userData.regNumber || 'N/A',
          name: userData.name || 'Unknown',
          ageCategory,
          registrationExpiry,
          subscriptions: displaySubscriptions,
          hasActiveSubscriptions: activeSubscriptions.length > 0,
          allSubscriptions: allSubscriptions,
          dobForInput,
          ...userData
        };
      });

      let enrichedUsers = (await Promise.all(enrichedUsersPromises)).filter(Boolean);

      enrichedUsers.sort((a, b) => {
        const numA = parseInt(a.regNumber.replace('SPC', '')) || 0;
        const numB = parseInt(b.regNumber.replace('SPC', '')) || 0;
        return numA - numB;
      });

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

  // QR CODE FUNCTIONS
  const loadQRCodes = async () => {
    try {
      const qrSnap = await getDocs(collection(db, 'qrCodes'));
      const codes = qrSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQrCodes(codes);
    } catch (error) {
      console.error("Error loading QR codes:", error);
      setAlert({ show: true, type: 'error', message: 'Failed to load QR codes' });
    }
  };

  const handleQRFileChange = (e) => {
    if (e.target.files[0]) {
      setQrFile(e.target.files[0]);
    }
  };

  const handleUploadQR = async () => {
    if (!qrName.trim() || !qrFile) {
      setAlert({ show: true, type: 'error', message: 'Please provide both a name and an image file.' });
      return;
    }
    const isDuplicate = qrCodes.some(qr => qr.name.toLowerCase() === qrName.trim().toLowerCase());
    if (isDuplicate) {
      setAlert({ show: true, type: 'error', message: 'A QR code with this name already exists.' });
      return;
    }
    setQrUploading(true);
    try {
      const storageRef = ref(storage, `qrCodes/${Date.now()}_${qrFile.name}`);
      const snapshot = await uploadBytes(storageRef, qrFile);
      const downloadURL = await getDownloadURL(snapshot.ref);
      await addDoc(collection(db, 'qrCodes'), {
        name: qrName.trim(),
        imageLink: downloadURL,
        storagePath: snapshot.metadata.fullPath,
        createdAt: Timestamp.now()
      });
      setAlert({ show: true, type: 'success', message: 'QR Code uploaded successfully!' });
      setQrName('');
      setQrFile(null);
      await loadQRCodes();
    } catch (error) {
      console.error("Error uploading QR:", error);
      setAlert({ show: true, type: 'error', message: 'Failed to upload QR code.' });
    } finally {
      setQrUploading(false);
    }
  };

  const handleDeleteQR = async (id, imageLink, storagePath) => {
    if (!window.confirm("Are you sure you want to delete this QR code?")) return;
    try {
      await deleteDoc(doc(db, 'qrCodes', id));
      if (storagePath) {
        const fileRef = ref(storage, storagePath);
        await deleteObject(fileRef).catch(err => console.warn("Storage file not found or already deleted", err));
      } else if (imageLink) {
         const fileRef = ref(storage, imageLink);
         await deleteObject(fileRef).catch(err => console.warn("Could not delete file from storage ref", err));
      }
      setAlert({ show: true, type: 'success', message: 'QR Code deleted.' });
      await loadQRCodes();
    } catch (error) {
      console.error("Error deleting QR:", error);
      setAlert({ show: true, type: 'error', message: 'Failed to delete QR code.' });
    }
  };

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
    if (formData.planType === 'registrationOnly') {
      return true;
    }
    return true;
  };

  const handleRegisterNewUser = async () => {
    if (!validateForm()) return;
    const duplicate = users.find(u => 
      u.mobile === formData.mobile || u.aadharNo === formData.aadharNo
    );
    if (duplicate) {
      setDuplicateWarning({ show: true, user: duplicate });
      return; 
    }
    setLoading(true);
    setIsGeneratingReceipt(true); 
    try {
      const now = new Date();
      const registrationDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const dobParts = formData.dob.split('-');
      const formattedDob = `${dobParts[2]}/${dobParts[1]}/${dobParts[0]}`;
      const infoRef = doc(db, 'users', '000info');
      const paymentInfoRef = doc(db, 'payments', '000info');
      let nextRegNum = 1;
      let nextInvoiceNo = 1;
      await runTransaction(db, async (transaction) => {
        const infoDoc = await transaction.get(infoRef);
        const paymentInfoDoc = await transaction.get(paymentInfoRef);
        let currentLast = 0;
        if (infoDoc.exists()) {
          currentLast = infoDoc.data().regNumLast || 0;
        } else {
          transaction.set(infoRef, { regNumLast: 0 });
        }
        nextRegNum = currentLast + 1;
        transaction.update(infoRef, { regNumLast: nextRegNum });
        let currentInvoiceLast = 0;
        if (paymentInfoDoc.exists()) {
          currentInvoiceLast = paymentInfoDoc.data().lastInvoice || 0;
        } else {
          transaction.set(paymentInfoRef, { lastInvoice: 0 });
        }
        const nextInvoiceNum = currentInvoiceLast + 1;
        const currentYear = new Date().getFullYear();
        const paddedNum = String(nextInvoiceNum).padStart(5, '0');
        nextInvoiceNo = `INV${currentYear}${paddedNum}`;
        transaction.update(paymentInfoRef, { lastInvoice: nextInvoiceNum });
      });
      const newRegNumber = `SPC${String(nextRegNum).padStart(5, '0')}`;
      const userData = {
        name: formData.name, 
        email: formData.email || '', 
        mobile: formData.mobile, 
        dob: formattedDob,
        gender: formData.gender, 
        fatherName: formData.fatherName || '', 
        address: formData.address,
        aadharNo: formData.aadharNo, 
        registrationDate: registrationDate,
        regNumber: newRegNumber,
      };
      const userRef = await addDoc(collection(db, 'users'), userData);
      setAlert({ show: true, type: 'success', message: `User registered successfully! ID: ${newRegNumber}.` });
      closeRegistrationModal();
      setLoading(false); 
      setIsGeneratingReceipt(false);
      await loadUsers(facilitiesMap);
    } catch (error) {
      console.error('Error registering user:', error);
      setAlert({ show: true, type: 'error', message: `Registration failed: ${error.message}` });
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
    loadQRCodes(); 
    setShowRegistrationModal(true);
  };
  
  const closeRegistrationModal = () => {
    setShowRegistrationModal(false);
    setFormData(initialFormData);
  };
  
  // ... existing code ...
  const openEditModal = async (userToEdit) => {
    setSelectedUser(userToEdit);
    setFormData({
      // FIX: Add || '' to every field to prevent 'undefined' errors
      name: userToEdit.name || '',
      email: userToEdit.email || '',
      mobile: userToEdit.mobile || '',
      dob: userToEdit.dobForInput || '',
      gender: userToEdit.gender || 'Male', // Default to 'Male' if missing, or '' if you prefer
      fatherName: userToEdit.fatherName || '',
      address: userToEdit.address || '',
      aadharNo: userToEdit.aadharNo || '',
      facilityId: '',
      planType: 'oneMonth',
      startDate: new Date().toISOString().split('T')[0],
      isRegistration: false, // Ensure this flag exists in edit mode
      utrNumber: '',
      qrCodeId: ''
    });
    await loadUserSubscriptionsAndPayments(userToEdit.id);
    setShowEditModal(true);
  };
// ... existing code ...
  
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
  
  const handleSubscriptionExtended = async (receiptInfo) => {
    closeExtensionModal();
    if (receiptInfo) {
      setReceiptData(receiptInfo);
      setShowReceiptModal(true);
    }
    await loadUsers(facilitiesMap);
    if (selectedUser) await loadUserSubscriptionsAndPayments(selectedUser.id);
  };

  const selectedFacility = facilities.find(f => f.id === formData.facilityId);
  const calculatedFee = !showEditModal && selectedFacility && selectedFacility.fees ? (() => {
    const feeData = selectedFacility.fees[formData.planType];
    if (!feeData) return 0;
    let baseFee = formData.gender === 'Male' ? feeData.price : feeData.priceFemale;
    if (formData.isRegistration && formData.planType !== 'withoutReg' && selectedFacility.fees['registration']) {
      const regFee = formData.gender === 'Male' ? selectedFacility.fees['registration'].price : selectedFacility.fees['registration'].price;
      baseFee += regFee;
    }
    return baseFee;
  })() : 0;

  const filteredUsers = users.filter(userItem => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearchTerm = 
      (userItem.name || '').toLowerCase().includes(searchLower) ||
      (userItem.regNumber || '').toLowerCase().includes(searchLower) ||
      String(userItem.mobile || '').includes(searchTerm) ||
      String(userItem.aadharNo || '').includes(searchTerm); 

    if (!matchesSearchTerm) return false;

    if (selectedFacilityFilter !== 'all' && selectedFacilityFilter !== '') {
      const hasSubscriptionForFacility = userItem.subscriptions.some(
        sub => sub.facilityId === selectedFacilityFilter
      );
      if (!hasSubscriptionForFacility) return false;
    }

    if (filterExpiryStatus === 'active') {
      if (!userItem.hasActiveSubscriptions) return false;
    } else if (filterExpiryStatus === 'expired') {
      if (userItem.hasActiveSubscriptions) return false;
    }

    if (filterAgeCategory !== 'all') {
      if (userItem.ageCategory !== filterAgeCategory) return false;
    }

    if (filterGender !== 'all') {
      if (userItem.gender !== filterGender) return false;
    }

    return true;
  });

  // --- EXPORT FUNCTIONS START ---
  const exportToExcel = () => {
    if (filteredUsers.length === 0) {
      setAlert({ show: true, type: 'error', message: 'No data to export' });
      return;
    }
    setExportLoading(true);
    try {
      const exportData = filteredUsers.map(u => ({
        'Reg Number': u.regNumber,
        'Name': u.name,
        'Mobile': u.mobile,
        'Age Category': u.ageCategory,
        'Gender': u.gender,
        'Registration Expiry': u.registrationExpiry,
        'Facilities & Expiry': u.subscriptions.map(s => `${s.facilityName} (${s.endDateStr})`).join(', ')
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-size columns slightly
      ws['!cols'] = [
        { wch: 15 }, // Reg Number
        { wch: 25 }, // Name
        { wch: 15 }, // Mobile
        { wch: 15 }, // Age
        { wch: 10 }, // Gender
        { wch: 20 }, // Reg Expiry
        { wch: 40 }  // Facilities
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Users');
      XLSX.writeFile(wb, `Users_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
      setAlert({ show: true, type: 'success', message: 'Excel exported successfully!' });
    } catch (error) {
      console.error('Export Error:', error);
      setAlert({ show: true, type: 'error', message: 'Failed to export Excel' });
    } finally {
      setExportLoading(false);
    }
  };

  const exportToPDF = () => {
    if (filteredUsers.length === 0) {
      setAlert({ show: true, type: 'error', message: 'No data to export' });
      return;
    }
    setExportLoading(true);
    
    const printWindow = window.open('', '_blank');
    const tableRows = filteredUsers.map((u, i) => `
      <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
        <td>${u.regNumber}</td>
        <td>${u.name}</td>
        <td>${u.mobile}</td>
        <td>${u.ageCategory}</td>
        <td>${u.registrationExpiry}</td>
        <td>
           ${u.subscriptions.map(s => `<div>${s.facilityName} <span style="color:#666; font-size:9px;">(${s.endDateStr})</span></div>`).join('')}
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>User Report</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11px; }
          h1 { text-align: center; color: #1e40af; margin-bottom: 5px; }
          .meta { text-align: center; font-size: 10px; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th { background-color: #2563eb; color: white; padding: 8px; text-align: left; font-size: 10px; }
          td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
          tr.even { background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>Raigarh Stadium Samiti - User Report</h1>
        <div class="meta">Generated: ${new Date().toLocaleString('en-GB')} | Total Records: ${filteredUsers.length}</div>
        <table>
          <thead>
            <tr>
              <th>Reg No</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Category</th>
              <th>Reg Expiry</th>
              <th>Facilities (Expiry)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <script>
           window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setExportLoading(false);
  };
  // --- EXPORT FUNCTIONS END ---

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

      {/* GENERATING RECEIPT OVERLAY */}
      {isGeneratingReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
          <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <Loader2 className="animate-spin text-blue-600 mb-3" size={32} />
            <p className="text-gray-900 font-semibold text-lg">Generating Receipt...</p>
            <p className="text-gray-500 text-sm mt-1">Please wait a moment</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Users & Registrations</h1>
          <p className="text-gray-600">Manage user registrations and memberships</p>
        </div>
      </div>

    
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
   
            <div><p className="text-sm text-gray-600">Total Users</p><p className="text-2xl font-bold text-gray-900">{filteredUsers.length}</p></div>
            <Users className="text-blue-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            
            <div><p className="text-sm text-gray-600">Active Subscriptions</p><p className="text-2xl font-bold text-green-600">{filteredUsers.filter(u => u.hasActiveSubscriptions).length}</p></div>
            <CheckCircle className="text-green-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
          
            <div><p className="text-sm text-gray-600">No Active Subscription</p><p className="text-2xl font-bold text-red-600">{filteredUsers.filter(u => !u.hasActiveSubscriptions).length}</p></div>
            <AlertCircle className="text-red-500" size={32} />
          </div>
        </div>
      </div>
      {/* Search & Register Button */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
  <div className="flex flex-wrap gap-4 items-center justify-between">
    <input
      type="text"
      placeholder="Search by name, reg#, mobile, or aadhar..." 
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />

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

    {/* Expiry Status Filter */}
    <select
      value={filterExpiryStatus}
      onChange={(e) => setFilterExpiryStatus(e.target.value)}
      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      <option value="all">All Subscriptions</option>
      <option value="active">Active Subscriptions</option>
      <option value="expired">Expired Subscriptions</option>
    </select>

    {/* Age Category Filter */}
    <select
      value={filterAgeCategory}
      onChange={(e) => setFilterAgeCategory(e.target.value)}
      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      <option value="all">All Age Categories</option>
      <option value="Child">Child</option>
      <option value="Adult">Adult</option>
      <option value="Senior">Senior</option>
    </select>

    {/* Gender Filter */}
    <select
      value={filterGender}
      onChange={(e) => setFilterGender(e.target.value)}
      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      <option value="all">All Genders</option>
      <option value="Male">Male</option>
      <option value="Female">Female</option>
    </select>

    {/* EXPORT BUTTONS */}
    <div className="flex gap-2">
      <button 
        onClick={exportToPDF} 
        disabled={exportLoading}
        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1"
        title="Export PDF"
      >
        <FileDown size={18} />
      </button>
      <button 
        onClick={exportToExcel}
        disabled={exportLoading} 
        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1"
        title="Export Excel"
      >
        <Download size={18} />
      </button>
    </div>

    <button onClick={openRegistrationModal} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
      <User size={18} />Register New User
    </button>
  
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reg Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration Expiry</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facilities</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No users found</td></tr>
              ) : (
                filteredUsers.map(userItem => (
                  <tr key={userItem.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{userItem.regNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{userItem.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{userItem.ageCategory}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`${userItem.registrationExpiry === 'Expired' ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                        {userItem.registrationExpiry}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {userItem.subscriptions.length > 0 ? (
                        <div className="space-y-1">
                          {userItem.subscriptions.map((sub, idx) => (
                            <div key={idx} className={`${sub.isActive ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                              {sub.facilityName}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">No active plan</span>
                      )}
                    </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="space-y-1">
                      {userItem.subscriptions.length > 0 ? (
                        userItem.subscriptions.map((sub, idx) => (
                          <div key={idx} className={`${sub.isActive ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                            {sub.endDateStr}
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => openEditModal(userItem)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit User"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedUser(userItem);
                          openExtensionModal();
                        }}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Renew/Extend Subscription"
                      >
                        <RefreshCcw size={18} />
                      </button>
                       <button 
                        onClick={() => handleDeleteUser(userItem.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete User"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTRATION MODAL */}
      <UserFormModal
        isOpen={showRegistrationModal}
        onClose={closeRegistrationModal}
        formData={formData}
        handleInputChange={handleInputChange}
        handleSubmit={handleRegisterNewUser}
        loading={loading}
        facilities={facilities}
        selectedFacility={selectedFacility}
        calculatedFee={calculatedFee}
        isEditMode={false}
        qrCodes={qrCodes} 
      />

      {/* EDIT USER MODAL */}
      <UserFormModal
        isOpen={showEditModal}
        onClose={closeEditModal}
        formData={formData}
        handleInputChange={handleInputChange}
        handleSubmit={handleUpdateUser}
        loading={loading}
        facilities={facilities}
        isEditMode={true}
        selectedUser={selectedUser}
        userSubscriptions={selectedUserSubscriptions}
        userPayments={selectedUserPayments}
        onExtendSubscriptionClick={() => {
            closeEditModal();
            openExtensionModal();
        }}
        qrCodes={qrCodes} 
      />

      {/* SUBSCRIPTION EXTENSION MODAL */}
      <SubscriptionExtensionModal
        isOpen={showExtensionModal}
        onClose={closeExtensionModal}
        user={selectedUser}
        staffData={staffUser}
        facilities={facilities}
        onSubscriptionExtended={handleSubscriptionExtended}
        selectedFacilityId={selectedFacilityForExtension}
        setAlert={setAlert}
      />

      {/* DUPLICATE USER WARNING MODAL */}
      {duplicateWarning.show && duplicateWarning.user && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="bg-orange-100 p-3 rounded-full mb-4">
                <AlertTriangle className="text-orange-600 w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">User Already Exists</h3>
              <p className="text-gray-600 mb-6">
                A user with this mobile number or Aadhar already exists in the system.
              </p>
              
              <div className="bg-gray-50 rounded-lg p-4 w-full mb-6 border border-gray-200 text-left">
                <p className="text-sm text-gray-500 mb-1">Existing User Details:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-semibold text-gray-700">Name:</span>
                  <span>{duplicateWarning.user.name}</span>
                  <span className="font-semibold text-gray-700">Reg Number:</span>
                  <span className="font-mono bg-gray-200 px-1 rounded">{duplicateWarning.user.regNumber}</span>
                  <span className="font-semibold text-gray-700">Mobile:</span>
                  <span>{duplicateWarning.user.mobile}</span>
                  <span className="font-semibold text-gray-700">Aadhar:</span>
                  <span>{duplicateWarning.user.aadharNo}</span>
                </div>
              </div>

              <div className="flex flex-col w-full gap-3">
                <button 
                  onClick={() => setDuplicateWarning({ show: false, user: null })}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Edit New User Details & Proceed
                </button>
                <button 
                  onClick={() => {
                    setDuplicateWarning({ show: false, user: null });
                    closeRegistrationModal();
                  }} 
                  className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel Registration
                </button>
              </div>
            </div>
          </div>
        </div>
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

export default UserRegistrationPage;