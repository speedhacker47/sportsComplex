'use client';
import React, { useState, useEffect } from 'react';
import { X, Search, Check, Save, Plus } from 'lucide-react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, doc, runTransaction, Timestamp } from 'firebase/firestore';

const ManualPaymentModal = ({ isOpen, onClose, onPaymentAdded }) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [facilities, setFacilities] = useState([]);
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserList, setShowUserList] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    amount: '',
    facilityId: '',
    planType: 'oneMonth',
    months: [],
    isRegistration: false,
    transactionId: '',
    status: 'completed'
  });

  // Month Selection Helpers
  const [addMonthVal, setAddMonthVal] = useState(new Date().getMonth().toString());
  const [addYearVal, setAddYearVal] = useState(new Date().getFullYear());

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setFormData({
      amount: '',
      facilityId: '',
      planType: 'oneMonth',
      months: [],
      isRegistration: false,
      transactionId: '',
      status: 'completed'
    });
    setSelectedUser(null);
    setSearchTerm('');
    setAddMonthVal(new Date().getMonth().toString());
    setAddYearVal(new Date().getFullYear());
  };

  const loadInitialData = async () => {
    try {
      // Load Facilities
      const facSnap = await getDocs(collection(db, 'facilities'));
      setFacilities(facSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Load Users
      const userSnap = await getDocs(collection(db, 'users'));
      setUsers(userSnap.docs
        .filter(d => d.id !== '000info')
        .map(d => ({ id: d.id, ...d.data() }))
      );
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter(u => 
    (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.mobile?.toString() || '').includes(searchTerm) ||
    (u.regNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  ).slice(0, 5);

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setSearchTerm(`${user.name} (${user.regNumber})`);
    setShowUserList(false);
  };

  const addMonth = () => {
    const monthName = new Date(addYearVal, addMonthVal).toLocaleString('default', { month: 'long' });
    const newMonthStr = `${monthName} ${addYearVal}`;
    
    if (!formData.months.includes(newMonthStr)) {
        setFormData(prev => ({ ...prev, months: [...prev.months, newMonthStr] }));
    }
  };

  const removeMonth = (monthToRemove) => {
    setFormData(prev => ({ ...prev, months: prev.months.filter(m => m !== monthToRemove) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) {
      alert("Please select a user");
      return;
    }
    if (!formData.amount || !formData.facilityId) {
      alert("Please fill in Facility and Amount");
      return;
    }

    setLoading(true);
    try {
      const paymentInfoRef = doc(db, 'payments', '000info');
      const newPaymentRef = doc(collection(db, 'payments'));

      await runTransaction(db, async (transaction) => {
        // 1. Get and Increment Invoice Number from 000info
        const infoDoc = await transaction.get(paymentInfoRef);
        let currentLastInvoice = 0;
        
        if (infoDoc.exists()) {
            currentLastInvoice = infoDoc.data().lastInvoice || 0;
        } else {
            transaction.set(paymentInfoRef, { lastInvoice: 0 });
        }

        const nextInvoiceNum = currentLastInvoice + 1;
        const currentYear = new Date().getFullYear();
        // Format: INV202600001 (No dash, 5 digit padding)
        const paddedNum = String(nextInvoiceNum).padStart(5, '0');
        const newInvoiceNo = `INV${currentYear}${paddedNum}`;

        transaction.update(paymentInfoRef, { lastInvoice: nextInvoiceNum });

        // 2. Prepare Month Array
        // If registration is checked, add "Registration" to the start of the array
        let finalMonths = [...formData.months];
        if (formData.isRegistration) {
            finalMonths.unshift("Registration");
        }

        // 3. Prepare Payment Data
        const paymentData = {
          amount: parseFloat(formData.amount),
          facilityId: formData.facilityId,
          invoiceNo: newInvoiceNo,
          method: "Manual",
          month: finalMonths, // Updated array
          paymentDate: Timestamp.now(),
          planType: formData.planType,
          processedBy: "Admin", 
          qrCodeName: "",
          status: "completed",
          transactionId: formData.transactionId.trim() || "Manual",
          userId: selectedUser.id,
          isRegistration: formData.isRegistration,
          
          user: {
            name: selectedUser.name,
            mobile: selectedUser.mobile,
            regNumber: selectedUser.regNumber,
            isGuest: selectedUser.isGuest || false
          },
          facility: {
             name: facilities.find(f => f.id === formData.facilityId)?.name || 'Unknown'
          }
        };

        transaction.set(newPaymentRef, paymentData);
      });

      onPaymentAdded();
      onClose();
    } catch (error) {
      console.error("Error adding payment:", error);
      alert("Failed to add payment: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
       {/* CSS to hide number input spinners */}
      <style jsx global>{`
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Plus size={24} className="text-blue-600" />
            Add Manual Payment
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* User Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select User *</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowUserList(true);
                  setSelectedUser(null);
                }}
                placeholder="Search name, mobile or reg number..."
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${selectedUser ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              {selectedUser && (
                <Check className="absolute right-3 top-2.5 text-green-600" size={18} />
              )}
            </div>
            
            {showUserList && searchTerm && !selectedUser && (
              <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {filteredUsers.length > 0 ? filteredUsers.map(user => (
                  <div 
                    key={user.id} 
                    onClick={() => handleUserSelect(user)}
                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                  >
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-500 flex justify-between">
                        <span>{user.regNumber}</span>
                        <span>{user.mobile}</span>
                    </div>
                  </div>
                )) : (
                  <div className="p-3 text-sm text-gray-500 text-center">No users found</div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Facility */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facility *</label>
              <select
                value={formData.facilityId}
                onChange={(e) => setFormData({...formData, facilityId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Facility</option>
                {facilities.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

             {/* Plan */}
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan Type</label>
              <select
                value={formData.planType}
                onChange={(e) => setFormData({...formData, planType: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="oneMonth">One Month</option>
                <option value="threeMonth">Three Months</option>
                <option value="sixMonth">Six Months</option>
                <option value="year">One Year</option>
                <option value="registrationOnly">Registration Only</option>
                <option value="custom">Custom / Other</option>
              </select>
            </div>
          </div>

          {/* Registration Checkbox */}
          <div className="flex items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
            <input 
                type="checkbox" 
                id="isRegistration" 
                checked={formData.isRegistration}
                onChange={(e) => setFormData({...formData, isRegistration: e.target.checked})}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="isRegistration" className="ml-2 text-sm font-medium text-gray-900 cursor-pointer">
                Include Registration Fee
            </label>
          </div>

          {/* Month Selection */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
             <label className="block text-sm font-medium text-gray-700 mb-2">Months Covered</label>
             <div className="flex gap-2 mb-3">
                <select 
                    value={addMonthVal} 
                    onChange={(e) => setAddMonthVal(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                >
                    {Array.from({length: 12}, (_, i) => (
                        <option key={i} value={i}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>
                    ))}
                </select>
                <select 
                    value={addYearVal} 
                    onChange={(e) => setAddYearVal(e.target.value)}
                    className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                >
                    {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
                <button 
                    type="button" 
                    onClick={addMonth} 
                    className="px-3 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                >
                    <Plus size={16} /> Add
                </button>
             </div>
             
             <div className="flex flex-wrap gap-2 min-h-[30px] p-2 bg-white rounded border border-gray-200">
                {formData.months.length > 0 ? (
                    formData.months.map((m, idx) => (
                        <span key={idx} className="bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded text-xs flex items-center gap-1">
                            {m}
                            <button type="button" onClick={() => removeMonth(m)} className="text-blue-400 hover:text-red-500">
                                <X size={14} />
                            </button>
                        </span>
                    ))
                ) : (
                    <span className="text-gray-400 text-xs italic">No months added yet...</span>
                )}
             </div>
          </div>

          {/* Amount Only */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (₹) *</label>
            <input
              type="number"
              value={formData.amount}
              onWheel={(e) => e.target.blur()}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 text-lg"
              placeholder="0.00"
              required
            />
          </div>

          {/* Transaction ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID (Optional)</label>
            <input
              type="text"
              value={formData.transactionId}
              onChange={(e) => setFormData({...formData, transactionId: e.target.value})}
              placeholder="Leave blank for 'Manual'"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? 'Processing...' : <><Save size={18} /> Save Manual Payment</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default ManualPaymentModal;