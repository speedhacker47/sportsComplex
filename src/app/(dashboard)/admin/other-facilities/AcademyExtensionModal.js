'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, DollarSign, Banknote, Wifi, AlertCircle, IndianRupee, QrCode, ChevronDown, Check, Loader2 } from 'lucide-react';
import { Timestamp, doc, updateDoc, addDoc, collection, getDocs, query, orderBy, limit, runTransaction } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

// Helper: Calculate End Date
const calculateEndDate = (startDate, months) => {
    if (!startDate) return '';
    const start = new Date(startDate);
    const end = new Date(start);
    const monthsToAdd = Number(months);
    
    if (!isNaN(monthsToAdd) && monthsToAdd > 0) {
        end.setMonth(end.getMonth() + monthsToAdd);
    } else {
        end.setMonth(end.getMonth() + 1);
    }
    return end.toISOString().split('T')[0];
};

const AcademyExtensionModal = ({
    isOpen, onClose, academy, onSubscriptionExtended, setAlert, staffUser
}) => {
    // Current Staff Info
    const currentStaff = useMemo(() => {
        return staffUser || { uid: 'system', name: 'System Admin' };
    }, [staffUser]);

    const [loading, setLoading] = useState(false);
    const [fetchingSub, setFetchingSub] = useState(false);
    
    // QR and Payment State
    const [qrCodes, setQrCodes] = useState([]);
    const [selectedQr, setSelectedQr] = useState(null);
    const [utrNumber, setUtrNumber] = useState('');
    const [loadingQrs, setLoadingQrs] = useState(false);
    const [showLargeQr, setShowLargeQr] = useState(false);

    // Subscription State
    const [currentSubscriptionId, setCurrentSubscriptionId] = useState(null);
    const [currentSubscriptionData, setCurrentSubscriptionData] = useState(null);
    
    // Form State
    const [extensionFormData, setExtensionFormData] = useState({
        startDate: new Date().toISOString().split('T')[0],
        months: 1, // Default 1 month
        customPrice: '',
    });
    const [useCustomPrice, setUseCustomPrice] = useState(false);

    // Month Selection State
    const [selectedMonths, setSelectedMonths] = useState([]);
    const [monthOptions, setMonthOptions] = useState([]);

    // 1. Fetch QR Codes
    useEffect(() => {
        const fetchQrCodes = async () => {
            setLoadingQrs(true);
            try {
                const qrSnap = await getDocs(collection(db, 'qrCodes'));
                const codes = qrSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setQrCodes(codes);
                if (codes.length > 0) setSelectedQr(codes[0]);
            } catch (error) {
                console.error("Error fetching QR codes:", error);
            } finally {
                setLoadingQrs(false);
            }
        };

        if (isOpen) {
            fetchQrCodes();
            setUtrNumber('');
            setShowLargeQr(false);
        }
    }, [isOpen]);

    // 2. Fetch Active Subscription & Set Defaults
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
                setUseCustomPrice(false);
                setUtrNumber('');
            } catch (error) {
                console.error("Error fetching subscription:", error);
                if (setAlert) setAlert({ show: true, type: 'error', message: "Could not fetch subscription." });
            } finally {
                setFetchingSub(false);
            }
        };
        fetchSubscription();
    }, [isOpen, academy?.id, setAlert]);

    // 3. Generate Month Options & Sync with Duration Input
    useEffect(() => {
        if (!extensionFormData.startDate) return;

        const start = new Date(extensionFormData.startDate);
        const options = [];
        
        // Generate options for the next 12 months
        for (let i = 0; i < 12; i++) {
            const d = new Date(start);
            d.setMonth(start.getMonth() + i);
            const monthName = d.toLocaleString('default', { month: 'long' });
            const year = d.getFullYear();
            options.push(`${monthName} ${year}`);
        }
        setMonthOptions(options);

        // Auto-select months based on numeric duration input
        const duration = Number(extensionFormData.months) || 1;
        const defaultSelection = options.slice(0, duration);
        setSelectedMonths(defaultSelection);

    }, [extensionFormData.startDate, extensionFormData.months]);

    // Handle Month Pill Click
    const toggleMonth = (monthStr) => {
        // Find index of clicked month
        const index = monthOptions.indexOf(monthStr);
        if (index === -1) return;

        // If clicking a month, we usually want to select everything up to that month
        // Or toggle logic. Here, we'll make it simple: Selecting a month sets duration to that point.
        const newDuration = index + 1;
        
        setExtensionFormData(prev => ({ ...prev, months: newDuration }));
    };

    const handleExtensionInputChange = (e) => {
        const { name, value } = e.target;
        setExtensionFormData(prev => ({ ...prev, [name]: value }));
    };

    const getCalculatedAmount = () => {
        if (useCustomPrice && extensionFormData.customPrice) {
            return parseFloat(extensionFormData.customPrice);
        }
        return (academy.monthlyPrice || 0) * parseInt(extensionFormData.months || 1);
    };

    const processDatabaseUpdate = async (paymentTransactionId) => {
        if (!academy?.id) throw new Error("Academy ID missing");

        const calculatedAmount = getCalculatedAmount();
        const duration = parseInt(extensionFormData.months);
        const startDateTimestamp = Timestamp.fromDate(new Date(extensionFormData.startDate));
        const endDateString = calculateEndDate(extensionFormData.startDate, duration);
        const endDateTimestamp = Timestamp.fromDate(new Date(endDateString));

        // Prepare References
        const paymentInfoRef = doc(db, 'academyPayments', '000info'); // Using academyPayments info for invoice sequence
        const newPaymentRef = doc(collection(db, 'academyPayments'));
        
        let subscriptionRef;
        if (currentSubscriptionId) {
            subscriptionRef = doc(db, 'academies', academy.id, 'subscriptions', currentSubscriptionId);
        } else {
            subscriptionRef = doc(collection(db, 'academies', academy.id, 'subscriptions'));
        }

        // Run Transaction
        await runTransaction(db, async (transaction) => {
            // 1. Invoice Number Logic
            const infoDoc = await transaction.get(paymentInfoRef);
            let currentLastInvoice = 0;
            if (infoDoc.exists()) {
                currentLastInvoice = infoDoc.data().lastInvoice || 0;
            } else {
                transaction.set(paymentInfoRef, { lastInvoice: 0 });
            }

            const nextInvoiceNum = currentLastInvoice + 1;
            const currentYear = new Date().getFullYear();
            const paddedNum = String(nextInvoiceNum).padStart(5, '0');
            const newInvoiceNo = `INV${currentYear}${paddedNum}`; // Different prefix for Academy

            transaction.update(paymentInfoRef, { lastInvoice: nextInvoiceNum });

            // 2. Payment Data
            const paymentData = {
                academyId: academy.id,
                amount: calculatedAmount,
                paymentDate: Timestamp.now(),
                method: 'Online',
                transactionId: paymentTransactionId,
                status: 'pending', // Pending verification
                months: selectedMonths,
                durationNumeric: duration,
                qrCodeName: selectedQr?.name || 'Unknown',
                processedBy: currentStaff.uid || 'system',
                invoiceNo: newInvoiceNo,
                startDate: startDateTimestamp,
                endDate: endDateTimestamp,
                subscription: `${academy.id}/${subscriptionRef.id}`,
            };

            // 3. Subscription Data
            const subData = {
                startDate: startDateTimestamp,
                endDate: endDateTimestamp,
                monthlyPrice: academy.monthlyPrice,
                status: 'active',
                updatedAt: Timestamp.now(),
                lastPaymentId: newPaymentRef.id,
            };

            transaction.set(newPaymentRef, paymentData);

            if (currentSubscriptionId) {
                transaction.update(subscriptionRef, {
                    ...subData, 
                    extendedAt: Timestamp.now(), 
                    extendedBy: currentStaff.uid || 'system'
                });
            } else {
                transaction.set(subscriptionRef, {
                    ...subData, 
                    academyId: academy.id, 
                    createdAt: Timestamp.now(),
                    createdBy: currentStaff.uid || 'system'
                });
            }
        });

        return newPaymentRef.id;
    };

    const handleExtendSubscription = async () => {
        setLoading(true);
        const calculatedAmount = getCalculatedAmount();

        if (!extensionFormData.startDate || !extensionFormData.months) {
            setAlert({ show: true, type: 'error', message: 'Please fill all required fields.' });
            setLoading(false);
            return;
        }

        if (useCustomPrice && (!extensionFormData.customPrice || parseFloat(extensionFormData.customPrice) <= 0)) {
            setAlert({ show: true, type: 'error', message: 'Please enter a valid custom price.' });
            setLoading(false);
            return;
        }

        if (!utrNumber.trim()) {
            setAlert({ show: true, type: 'error', message: 'Please enter the UTR Number.' });
            setLoading(false);
            return;
        }

        try {
            const newPaymentId = await processDatabaseUpdate(utrNumber.trim());
            setAlert({ show: true, type: 'success', message: 'Payment recorded & subscription extended!' });
            
            // Prepare Receipt Data
            const receiptData = {
                paymentId: newPaymentId,
                transactionId: utrNumber.trim(),
                paymentDate: new Date().toLocaleDateString('en-GB'),
                userName: academy.name || 'Unknown',
                regNumber: academy.mobile || 'N/A', // Using mobile as reg ID for academy context
                facilityName: 'Other Facility / Academy',
                planType: `${extensionFormData.months} Month(s)`,
                amount: calculatedAmount,
                status: 'pending',
                months: selectedMonths
            };

            onSubscriptionExtended(receiptData);
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
    const newCalculatedEndDate = extensionFormData.startDate ? calculateEndDate(extensionFormData.startDate, extensionFormData.months) : 'N/A';
    const calculatedAmount = getCalculatedAmount();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-gray-900">Extend Subscription</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
                </div>

                {fetchingSub ? (
                    <div className="p-10 flex flex-col items-center justify-center">
                        <Loader2 className="animate-spin text-blue-600 mb-3" size={32} />
                        <p className="text-gray-600">Loading subscription...</p>
                    </div>
                ) : (
                    <div className="p-6">
                        {/* Academy Details */}
                        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <p className="text-sm text-gray-500">Academy/Facility</p>
                            <p className="font-semibold text-gray-900">{academy?.name}</p>
                            <div className="mt-2 pt-2 border-t border-gray-200 text-sm flex justify-between">
                                <span className="text-gray-500">Monthly Price: <span className="text-gray-900 font-bold">₹{academy?.monthlyPrice}</span></span>
                                {currentSubscriptionId && <span className="text-red-600 font-medium">Expires: {currentEndDateStr}</span>}
                            </div>
                        </div>

                        {/* Dates & Duration */}
                        <div className="space-y-4 mb-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                    <input 
                                        type="date" 
                                        name="startDate" 
                                        value={extensionFormData.startDate} 
                                        onChange={handleExtensionInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration (Months)</label>
                                    <input 
                                        type="number" 
                                        name="months" 
                                        value={extensionFormData.months} 
                                        onChange={handleExtensionInputChange}
                                        min="1" max="24"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Expiry Date</label>
                                <input 
                                    type="text" 
                                    value={newCalculatedEndDate !== 'N/A' ? newCalculatedEndDate.split('-').reverse().join('/') : 'N/A'} 
                                    disabled 
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500" 
                                />
                            </div>

                            {/* Month Pills */}
                            <div className="border rounded-lg p-4 bg-white">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Coverage Period:</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {monthOptions.map((month, index) => {
                                        const isSelected = index < parseInt(extensionFormData.months);
                                        return (
                                            <button
                                                key={month}
                                                onClick={() => toggleMonth(month)}
                                                className={`px-2 py-1.5 text-xs text-center border rounded-md transition-colors flex items-center justify-center gap-1
                                                    ${isSelected 
                                                        ? 'bg-green-100 border-green-500 text-green-800 font-semibold hover:bg-green-200' 
                                                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                                    }`}
                                            >
                                                {month}
                                                {isSelected && <Check size={12} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Custom Price Toggle */}
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <div className="flex items-center mb-2">
                                    <input type="checkbox" id="useCustomPrice" checked={useCustomPrice} onChange={(e) => setUseCustomPrice(e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-gray-300" />
                                    <label htmlFor="useCustomPrice" className="ml-2 block text-sm text-gray-900">Use Custom Price (Override calculation)</label>
                                </div>
                                {useCustomPrice && (
                                    <input type="number" name="customPrice" value={extensionFormData.customPrice} onChange={handleExtensionInputChange} min="0" placeholder="Enter custom amount" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                                )}
                            </div>
                        </div>

                        {/* Payment & QR Section */}
                        <div className="mb-6">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Payment Details</h3>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                {loadingQrs ? (
                                    <div className="text-center text-gray-500">Loading QR...</div>
                                ) : qrCodes.length > 0 ? (
                                    <div className="flex flex-col items-center">
                                        <div className="w-full mb-3">
                                            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Scan QR Code</label>
                                            <div className="relative">
                                                <select 
                                                    className="w-full appearance-none bg-white border border-gray-300 text-gray-700 py-2 px-3 pr-8 rounded focus:outline-none focus:border-blue-500 text-sm"
                                                    onChange={(e) => setSelectedQr(qrCodes.find(qr => qr.id === e.target.value))}
                                                    value={selectedQr?.id || ''}
                                                >
                                                    {qrCodes.map(qr => <option key={qr.id} value={qr.id}>{qr.name}</option>)}
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"><ChevronDown size={14} /></div>
                                            </div>
                                        </div>

                                        {selectedQr && (
                                            <div className="bg-white p-2 rounded shadow-sm border border-gray-200 mb-4">
                                                <img 
                                                    src={selectedQr.imageLink} 
                                                    alt={selectedQr.name} 
                                                    className="w-40 h-40 object-contain cursor-pointer hover:opacity-95"
                                                    onClick={() => setShowLargeQr(true)}
                                                />
                                            </div>
                                        )}

                                        <div className="w-full">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Enter UTR Number *</label>
                                            <input 
                                                type="text" 
                                                placeholder="e.g. 123456789012"
                                                value={utrNumber}
                                                onChange={(e) => setUtrNumber(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-red-500 flex flex-col items-center gap-2">
                                        <AlertCircle size={24} />
                                        <p className="text-sm">No QR Codes available.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Total Pay */}
                        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                            <span className="text-gray-600 font-medium">Total to Pay</span>
                            <span className="text-2xl font-bold text-gray-900 flex items-center">
                                <IndianRupee size={20} className="text-gray-400" />{calculatedAmount}
                            </span>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3 justify-end">
                            <button onClick={onClose} className="px-5 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                            <button 
                                onClick={handleExtendSubscription} 
                                disabled={loading || calculatedAmount === 0 || !utrNumber.trim()} 
                                className={`px-5 py-2 rounded-lg text-white font-medium flex items-center gap-2 ${
                                    loading || calculatedAmount === 0 || !utrNumber.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {loading ? 'Processing...' : 'Record Payment'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* QR Zoom Modal */}
            {showLargeQr && selectedQr && (
                <div className="fixed inset-0 z-[60] bg-black bg-opacity-90 flex items-center justify-center p-4" onClick={() => setShowLargeQr(false)}>
                    <div className="relative">
                        <button onClick={() => setShowLargeQr(false)} className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2"><X size={32} /></button>
                        <div className="bg-white p-4 rounded-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                            <img src={selectedQr.imageLink} alt={selectedQr.name} className="max-w-full max-h-[80vh] object-contain" />
                            <p className="text-center font-bold text-lg mt-2">{selectedQr.name}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AcademyExtensionModal;