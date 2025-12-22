'use client';
import React, { useState, useEffect } from 'react';
import { X, Calendar, Banknote, Wifi, IndianRupee } from 'lucide-react';
import { Timestamp, doc, updateDoc, addDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const calculateEndDate = (startDate, months = 1) => {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  return end.toISOString().split('T')[0];
};

const AcademyExtensionModal = ({
  isOpen,
  onClose,
  academy,
  onSubscriptionExtended,
  setAlert,
  staffUser,
}) => {
  const [loading, setLoading] = useState(false);
  const [fetchingSub, setFetchingSub] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [currentSubscriptionId, setCurrentSubscriptionId] = useState(null);
  const [currentSubscriptionData, setCurrentSubscriptionData] = useState(null);
  const [extensionFormData, setExtensionFormData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    months: 1,
    customPrice: '',
  });
  const [useCustomPrice, setUseCustomPrice] = useState(false);

  // Fetch current subscription
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!isOpen || !academy?.id) return;
      
      setFetchingSub(true);
      try {
        const subRef = collection(db, 'academies', academy.id, 'subscriptions');
        const q = query(subRef, orderBy('createdAt', 'desc'), limit(1));
        const snapshot = await getDocs(q);

        let nextStartDate = new Date().toISOString().split('T')[0];
        
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data();
          setCurrentSubscriptionId(snapshot.docs[0].id);
          setCurrentSubscriptionData(docData);
          
          if (docData.endDate) {
            const endDateObj = docData.endDate.toDate();
            endDateObj.setDate(endDateObj.getDate() + 1);
            nextStartDate = endDateObj.toISOString().split('T')[0];
          }
        }

        setExtensionFormData({
          startDate: nextStartDate,
          months: 1,
          customPrice: '',
        });
        setPaymentMethod('Cash');
        setUseCustomPrice(false);
      } catch (error) {
        console.error("Error fetching subscription:", error);
        if (setAlert) {
          setAlert({ show: true, type: 'error', message: "Could not fetch subscription." });
        }
      } finally {
        setFetchingSub(false);
      }
    };

    fetchSubscription();
  }, [isOpen, academy?.id, setAlert]);

  const handleExtensionInputChange = (e) => {
    const { name, value } = e.target;
    setExtensionFormData(prev => ({ ...prev, [name]: value }));
  };

  const getCalculatedAmount = () => {
    if (useCustomPrice && extensionFormData.customPrice) {
      return parseFloat(extensionFormData.customPrice);
    }
    return academy.monthlyPrice * parseInt(extensionFormData.months || 1);
  };

  const processDatabaseUpdate = async (actualPaymentMethod, paymentTransactionId = null) => {
    if (!academy?.id) throw new Error("Academy ID missing");

    const calculatedAmount = getCalculatedAmount();
    const startDateTimestamp = Timestamp.fromDate(new Date(extensionFormData.startDate));
    const endDateTimestamp = Timestamp.fromDate(
      new Date(calculateEndDate(extensionFormData.startDate, parseInt(extensionFormData.months)))
    );

    // Create payment record
    const paymentData = {
      academyId: academy.id,
      amount: calculatedAmount,
      paymentDate: Timestamp.now(),
      method: actualPaymentMethod,
      transactionId: paymentTransactionId || `MANUAL-${Date.now()}`,
      status: 'completed',
      months: parseInt(extensionFormData.months),
      processedBy: staffUser?.uid || 'system',
    };
    const paymentRef = await addDoc(collection(db, 'academyPayments'), paymentData);

    // Update or create subscription
    const subData = {
      startDate: startDateTimestamp,
      endDate: endDateTimestamp,
      monthlyPrice: academy.monthlyPrice,
      status: 'active',
      updatedAt: Timestamp.now(),
      lastPaymentId: paymentRef.id,
    };

    if (currentSubscriptionId) {
      const subscriptionRef = doc(db, 'academies', academy.id, 'subscriptions', currentSubscriptionId);
      await updateDoc(subscriptionRef, {
        ...subData,
        extendedAt: Timestamp.now(),
        extendedBy: staffUser?.uid || 'system',
      });
    } else {
      await addDoc(collection(db, 'academies', academy.id, 'subscriptions'), {
        ...subData,
        academyId: academy.id,
        createdAt: Timestamp.now(),
        createdBy: staffUser?.uid || 'system',
      });
    }
  };

  const handleExtendSubscription = async () => {
    if (!extensionFormData.startDate || !extensionFormData.months) {
      setAlert({ show: true, type: 'error', message: 'Please fill all required fields.' });
      return;
    }

    if (useCustomPrice && (!extensionFormData.customPrice || parseFloat(extensionFormData.customPrice) <= 0)) {
      setAlert({ show: true, type: 'error', message: 'Please enter a valid custom price.' });
      return;
    }

    setLoading(true);
    try {
      if (paymentMethod === 'Online') {
        // Simulate online payment
        await new Promise(resolve => setTimeout(resolve, 1500));
        await processDatabaseUpdate('Online', `TXN-${Date.now()}`);
        setAlert({ show: true, type: 'success', message: 'Online payment successful & subscription extended!' });
      } else {
        await processDatabaseUpdate('Cash');
        setAlert({ show: true, type: 'success', message: 'Cash payment recorded & subscription extended!' });
      }
      
      onSubscriptionExtended();
      onClose();
    } catch (error) {
      console.error('Extension Error:', error);
      setAlert({ show: true, type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentEndDateStr = currentSubscriptionData?.endDate?.toDate().toLocaleDateString('en-GB') || 'N/A';
  const newCalculatedEndDate = extensionFormData.startDate
    ? calculateEndDate(extensionFormData.startDate, parseInt(extensionFormData.months))
    : 'N/A';
  const calculatedAmount = getCalculatedAmount();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-gray-900">Extend Academy Subscription</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {fetchingSub ? (
          <div className="p-10 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading subscription...</p>
          </div>
        ) : (
          <div className="p-6">
            {/* Academy Info */}
            <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500">Academy Name</p>
              <p className="font-semibold text-gray-900">{academy?.name || 'Unknown'}</p>
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Monthly Price:</span>
                  <span className="font-medium text-gray-900 flex items-center">
                    <IndianRupee size={14} className="mr-1" />
                    {academy?.monthlyPrice}
                  </span>
                </div>
                {currentSubscriptionId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Current Expiry:</span>
                    <span className="font-medium text-red-600">{currentEndDateStr}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Extension Form */}
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Start Date *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={extensionFormData.startDate}
                    onChange={handleExtensionInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (Months) *
                  </label>
                  <input
                    type="number"
                    name="months"
                    value={extensionFormData.months}
                    onChange={handleExtensionInputChange}
                    min="1"
                    max="12"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New End Date
                </label>
                <input
                  type="text"
                  value={
                    newCalculatedEndDate !== 'N/A'
                      ? new Date(newCalculatedEndDate).toLocaleDateString('en-GB')
                      : 'N/A'
                  }
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                />
              </div>

              {/* Custom Price Option */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="useCustomPrice"
                    checked={useCustomPrice}
                    onChange={(e) => setUseCustomPrice(e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                  />
                  <label htmlFor="useCustomPrice" className="ml-2 block text-sm text-gray-900">
                    Use Custom Price (Override calculated amount)
                  </label>
                </div>
                {useCustomPrice && (
                  <input
                    type="number"
                    name="customPrice"
                    value={extensionFormData.customPrice}
                    onChange={handleExtensionInputChange}
                    min="0"
                    step="0.01"
                    placeholder="Enter custom amount"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            </div>

            {/* Payment Method */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-lg transition-all ${
                    paymentMethod === 'Cash'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Banknote size={20} />
                  <span className="font-medium">Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Online')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-lg transition-all ${
                    paymentMethod === 'Online'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Wifi size={20} />
                  <span className="font-medium">Online</span>
                </button>
              </div>
            </div>

            {/* Total Amount */}
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
              <div>
                <span className="text-gray-600 font-medium">Total to Pay</span>
                {!useCustomPrice && (
                  <p className="text-xs text-gray-500 mt-1">
                    ₹{academy?.monthlyPrice} × {extensionFormData.months} month(s)
                  </p>
                )}
              </div>
              <span className="text-2xl font-bold text-gray-900 flex items-center">
                <IndianRupee size={20} className="text-gray-400" />
                {calculatedAmount.toFixed(2)}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExtendSubscription}
                disabled={loading || calculatedAmount === 0}
                className={`px-5 py-2 rounded-lg text-white font-medium flex items-center gap-2 ${
                  loading || calculatedAmount === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : paymentMethod === 'Online'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>{paymentMethod === 'Online' ? 'Pay & Extend' : 'Record Payment'}</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcademyExtensionModal;