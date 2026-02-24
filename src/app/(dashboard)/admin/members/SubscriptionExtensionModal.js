import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, DollarSign, Banknote, Wifi, AlertCircle, IndianRupee, QrCode, ChevronDown, ZoomIn } from 'lucide-react';
import { Timestamp, doc, updateDoc, addDoc, collection, getDocs, query, orderBy, limit, where, setDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const calculateEndDate = (startDate, planType, duration) => {
    if (!startDate) return '';
    const start = new Date(startDate);
    let end = new Date(start);
    if (duration) {
        end.setMonth(end.getMonth() + duration);
    } else {
        switch (planType) {
            case 'oneMonth': end.setMonth(end.getMonth() + 1); break;
            case 'threeMonth': end.setMonth(end.getMonth() + 3); break;
            case 'sixMonth': end.setMonth(end.getMonth() + 6); break;
            case 'year': end.setFullYear(end.getFullYear() + 1); break;
            case 'withoutReg': end.setMonth(end.getMonth() + 1); break;
            default: end.setMonth(end.getMonth() + 1);
        }
    }
    return end.toISOString().split('T')[0];
};

// Helper: Generate Month Array from Date Range
const getMonthsInRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = [];
    let current = new Date(start);

    while (current <= end) {
        const monthYear = current.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!months.includes(monthYear)) {
            months.push(monthYear);
        }
        current.setMonth(current.getMonth() + 1);
    }
    return months;
};

const SubscriptionExtensionModal = ({
    isOpen, onClose, memberUser, user, staffData, facilities,
    onSubscriptionExtended, setAlert, selectedFacilityId
}) => {
    const targetUser = memberUser || user;
    const currentStaff = useMemo(() => {
        const staff = staffData || user;
        return staff || { uid: 'system', facility: '', isAdmin: false };
    }, [staffData, user]);

    const [fetchingSub, setFetchingSub] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingFees, setLoadingFees] = useState(false);

    // QR and UTR State
    const [qrCodes, setQrCodes] = useState([]);
    const [selectedQr, setSelectedQr] = useState(null);
    const [utrNumber, setUtrNumber] = useState('');
    const [loadingQrs, setLoadingQrs] = useState(false);
    const [showLargeQr, setShowLargeQr] = useState(false);

    const [targetSubscriptionId, setTargetSubscriptionId] = useState(null);
    const [currentSubscriptionData, setCurrentSubscriptionData] = useState(null);
    const [extensionFormData, setExtensionFormData] = useState({
        facilityId: '', planType: 'oneMonth',
        startDate: new Date().toISOString().split('T')[0],
        includeRegistration: false,
    });
    const [calculatedFee, setCalculatedFee] = useState(0);
    const [selectedFacilityFees, setSelectedFacilityFees] = useState({});

    // ALL facilities available
    const allowedFacilities = useMemo(() => {
        if (!facilities || facilities.length === 0) return [];
        return facilities;
    }, [facilities]);

    // Fetch QR Codes
    useEffect(() => {
        const fetchQrCodes = async () => {
            setLoadingQrs(true);
            try {
                const qrSnap = await getDocs(collection(db, 'qrCodes'));
                const codes = qrSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setQrCodes(codes);
                if (codes.length > 0) {
                    setSelectedQr(codes[0]);
                }
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

    // Fetch subscription for selected facility
    useEffect(() => {
        const fetchFacilitySubscription = async () => {
            if (!isOpen || !targetUser?.id) return;
            setFetchingSub(true);
            setTargetSubscriptionId(null);
            setCurrentSubscriptionData(null);

            try {
                let foundFacilityId = selectedFacilityId || '';
                let foundPlanType = 'oneMonth';
                let nextStartDate = new Date().toISOString().split('T')[0];

                if (!foundFacilityId && allowedFacilities.length > 0) {
                    foundFacilityId = allowedFacilities[0].id;
                }

                if (foundFacilityId) {
                    const subRef = collection(db, 'users', targetUser.id, 'subscriptions');
                    const q = query(subRef, where('facilityId', '==', foundFacilityId), orderBy('createdAt', 'desc'), limit(1));
                    const snapshot = await getDocs(q);

                    if (!snapshot.empty) {
                        const docData = snapshot.docs[0].data();
                        setTargetSubscriptionId(snapshot.docs[0].id);
                        setCurrentSubscriptionData(docData);
                        foundPlanType = docData.planType || 'oneMonth';
                        if (docData.endDate) {
                            const endDateObj = docData.endDate.toDate();
                            endDateObj.setDate(endDateObj.getDate() + 1);
                            nextStartDate = endDateObj.toISOString().split('T')[0];
                        }
                    }
                }

                setExtensionFormData({
                    facilityId: foundFacilityId,
                    planType: foundPlanType,
                    startDate: nextStartDate,
                    includeRegistration: false
                });
                setUtrNumber('');
                setSelectedFacilityFees({});
                setCalculatedFee(0);
            } catch (error) {
                console.error("Error fetching subscription:", error);
                if (setAlert) setAlert({ show: true, type: 'error', message: "Could not fetch subscription." });
            } finally {
                setFetchingSub(false);
            }
        };
        fetchFacilitySubscription();
    }, [isOpen, targetUser?.id, selectedFacilityId, allowedFacilities, setAlert]);

    // Fetch fees
    useEffect(() => {
        const loadFacilityFees = async () => {
            if (!extensionFormData.facilityId) {
                setSelectedFacilityFees({});
                return;
            }
            setLoadingFees(true);
            try {
                const feesRef = collection(db, 'facilities', extensionFormData.facilityId, 'fees');
                const feesSnapshot = await getDocs(feesRef);
                const feesData = {};
                feesSnapshot.forEach((doc) => {
                    feesData[doc.id] = { ...doc.data(), id: doc.id };
                });
                setSelectedFacilityFees(feesData);

                const availablePlans = Object.keys(feesData).filter(key => key !== 'registration');
                if (availablePlans.length > 0 && !availablePlans.includes(extensionFormData.planType)) {
                    setExtensionFormData(prev => ({ ...prev, planType: availablePlans[0] }));
                } else if (availablePlans.length === 0) {
                    setExtensionFormData(prev => ({ ...prev, planType: '' }));
                }
            } catch (error) {
                console.error('Error loading fees:', error);
                setAlert({ show: true, type: 'error', message: 'Error loading facility fees.' });
            } finally {
                setLoadingFees(false);
            }
        };
        if (isOpen && !fetchingSub) {
            loadFacilityFees();
        }
    }, [extensionFormData.facilityId, isOpen, fetchingSub]);

    // Calculate fee
    useEffect(() => {
        if (!targetUser || !selectedFacilityFees[extensionFormData.planType]) {
            setCalculatedFee(0);
            return;
        }
        const feeData = selectedFacilityFees[extensionFormData.planType];
        const userGender = targetUser.gender || 'Male';
        let fee = userGender === 'Male' ? feeData.price : feeData.price;
        if (extensionFormData.includeRegistration && extensionFormData.planType !== 'withoutReg' && selectedFacilityFees['registration']) {
            const regFee = userGender === 'Male' ? selectedFacilityFees['registration'].price : selectedFacilityFees['registration'].price;
            fee += regFee;
        }
        setCalculatedFee(fee);
    }, [extensionFormData.planType, extensionFormData.includeRegistration, selectedFacilityFees, targetUser?.gender]);

    const handleExtensionInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name === 'facilityId') {
            setTargetSubscriptionId(null);
            setCurrentSubscriptionData(null);
            setExtensionFormData(prev => ({
                ...prev,
                [name]: value,
                startDate: new Date().toISOString().split('T')[0]
            }));

            const fetchNewFacilitySub = async () => {
                if (!value || !targetUser?.id) return;
                try {
                    const subRef = collection(db, 'users', targetUser.id, 'subscriptions');
                    const q = query(subRef, where('facilityId', '==', value), orderBy('createdAt', 'desc'), limit(1));
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) {
                        const docData = snapshot.docs[0].data();
                        setTargetSubscriptionId(snapshot.docs[0].id);
                        setCurrentSubscriptionData(docData);
                        if (docData.endDate) {
                            const endDateObj = docData.endDate.toDate();
                            endDateObj.setDate(endDateObj.getDate() + 1);
                            setExtensionFormData(prev => ({
                                ...prev,
                                startDate: endDateObj.toISOString().split('T')[0]
                            }));
                        }
                    }
                } catch (error) {
                    console.error("Error fetching facility subscription:", error);
                }
            };
            fetchNewFacilitySub();
        } else {
            setExtensionFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    };

    // Import setDoc in your imports at the top of the file if not already there
    // import { ..., setDoc } from 'firebase/firestore'; 

    const processDatabaseUpdate = async (paymentTransactionId) => {
        if (!targetUser?.id) throw new Error("User ID missing");

        // 1. Calculate Dates
        const feeData = selectedFacilityFees[extensionFormData.planType];
        const duration = feeData?.duration || null;
        const startDateTimestamp = Timestamp.fromDate(new Date(extensionFormData.startDate));
        const endDateTimestamp = Timestamp.fromDate(new Date(calculateEndDate(extensionFormData.startDate, extensionFormData.planType, duration)));

        // 2. Prepare References
        const paymentInfoRef = doc(db, 'payments', '000info');
        const newPaymentRef = doc(collection(db, 'payments')); // Generate ID for new payment

        let subscriptionRef;
        if (targetSubscriptionId) {
            subscriptionRef = doc(db, 'users', targetUser.id, 'subscriptions', targetSubscriptionId);
        } else {
            subscriptionRef = doc(collection(db, 'users', targetUser.id, 'subscriptions'));
        }

        // 3. Run Transaction (Generate Invoice # -> Save Payment -> Save Subscription)
        await runTransaction(db, async (transaction) => {
            // A. Get Last Invoice Number
            const infoDoc = await transaction.get(paymentInfoRef);
            let currentLastInvoice = 0;
            if (infoDoc.exists()) {
                currentLastInvoice = infoDoc.data().lastInvoice || 0;
            } else {
                // Initialize if document doesn't exist
                transaction.set(paymentInfoRef, { lastInvoice: 0 });
            }

            // B. Generate New Invoice Number
            const nextInvoiceNum = currentLastInvoice + 1;
            const currentYear = new Date().getFullYear();
            const paddedNum = String(nextInvoiceNum).padStart(5, '0');
            const newInvoiceNo = `INV${currentYear}${paddedNum}`;

            // C. Update Last Invoice Number
            transaction.update(paymentInfoRef, { lastInvoice: nextInvoiceNum });

            // D. Prepare Payment Data
            const paymentData = {
                userId: targetUser.id,
                amount: calculatedFee,
                paymentDate: Timestamp.now(),
                method: 'Online',
                transactionId: paymentTransactionId,
                status: 'pending',
                facilityId: extensionFormData.facilityId,
                planType: extensionFormData.planType,
                qrCodeName: selectedQr?.name || 'Unknown',
                processedBy: currentStaff.uid || 'system',
                startDate: startDateTimestamp,
                endDate: endDateTimestamp,
                subscription: `${targetUser.id}/${subscriptionRef.id}`,
                month: getMonthsInRange(extensionFormData.startDate, calculateEndDate(extensionFormData.startDate, extensionFormData.planType, duration)), // <--- ADDED Month Array
                invoiceNo: newInvoiceNo // <--- NEW FIELD
            };

            // E. Prepare Subscription Data
            const subData = {
                facilityId: extensionFormData.facilityId,
                planType: extensionFormData.planType,
                startDate: startDateTimestamp,
                endDate: endDateTimestamp,
                status: 'active',
                updatedAt: Timestamp.now(),
                lastPaymentId: newPaymentRef.id,
            };

            // F. Writes
            transaction.set(newPaymentRef, paymentData);

            if (targetSubscriptionId) {
                // Determine if we need to merge or set. Using update logic here.
                transaction.update(subscriptionRef, {
                    ...subData, extendedAt: Timestamp.now(), extendedBy: currentStaff.uid || 'system'
                });
            } else {
                transaction.set(subscriptionRef, {
                    ...subData, userId: targetUser.id, createdAt: Timestamp.now(),
                    createdBy: currentStaff.uid || 'system'
                });
            }
        });

        return newPaymentRef.id;
    };

    const handleExtendSubscription = async () => {
        setLoading(true);
        if (!extensionFormData.facilityId || !extensionFormData.planType || !extensionFormData.startDate) {
            setAlert({ show: true, type: 'error', message: 'Please fill all required fields.' });
            setLoading(false);
            return;
        }

        if (!utrNumber.trim()) {
            setAlert({ show: true, type: 'error', message: 'Please enter the UTR Number.' });
            setLoading(false);
            return;
        }

        try {
            const newPaymentId = await processDatabaseUpdate(utrNumber.trim()); // <--- CAPTURE ID
            setAlert({ show: true, type: 'success', message: 'Payment recorded (Pending) & subscription extended!' });

            const facilityName = allowedFacilities.find(f => f.id === extensionFormData.facilityId)?.name || 'Unknown';

            const receiptData = {
                paymentId: newPaymentId, // <--- ADDED THIS LINE
                transactionId: utrNumber.trim(),
                // ... rest of object (paymentDate, userName etc)
                paymentDate: new Date().toLocaleDateString('en-GB'),
                userName: targetUser?.name || 'Unknown',
                regNumber: targetUser?.regNumber || 'N/A',
                facilityName: facilityName,
                planType: extensionFormData.planType,
                amount: calculatedFee,
                status: 'pending' // As per your logic
            };

            onSubscriptionExtended(receiptData); // Pass data
            // --- CHANGED CODE END ---

            onClose();
        } catch (error) {
            //...
            console.error('Extension Error:', error);
            setAlert({ show: true, type: 'error', message: error.message });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const currentEndDateStr = currentSubscriptionData?.endDate?.toDate().toLocaleDateString('en-GB') || 'N/A';
    const feeData = selectedFacilityFees[extensionFormData.planType];
    const newCalculatedEndDate = extensionFormData.startDate ? calculateEndDate(extensionFormData.startDate, extensionFormData.planType, feeData?.duration) : 'N/A';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-gray-900">Extend Subscription</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
                </div>

                {fetchingSub ? (
                    <div className="p-10 flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-gray-600">Loading subscription...</p>
                    </div>
                ) : (
                    <div className="p-6">
                        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <p className="text-sm text-gray-500">Member</p>
                            <p className="font-semibold text-gray-900">{targetUser?.name || 'Unknown'}</p>
                            {targetSubscriptionId && (
                                <div className="mt-2 pt-2 border-t border-gray-200 text-sm flex justify-between">
                                    <span className="text-gray-500">Previous Expiry:</span>
                                    <span className="font-medium text-red-600">{currentEndDateStr}</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4 mb-6">
                            {/* Facility & Plan Fields */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Facility *</label>
                                <select name="facilityId" value={extensionFormData.facilityId} onChange={handleExtensionInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                    <option value="">Select Facility</option>
                                    {allowedFacilities.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
                                {loadingFees ? (
                                    <div className="text-sm text-gray-500 animate-pulse">Loading pricing...</div>
                                ) : (
                                    <select
                                        name="planType"
                                        value={extensionFormData.planType}
                                        onChange={handleExtensionInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        disabled={!extensionFormData.facilityId || Object.keys(selectedFacilityFees).filter(k => k !== 'registration').length === 0}
                                    >
                                        {(() => {
                                            const availablePlans = Object.entries(selectedFacilityFees).filter(([key]) => key !== 'registration');
                                            return availablePlans.length > 0 ? (
                                                availablePlans.map(([key, value]) => (
                                                    <option key={key} value={key}>
                                                        {value.title || key} - ₹{targetUser?.gender === 'Male' ? value.price : value.price}
                                                    </option>
                                                ))
                                            ) : (
                                                <option value="">No plans available for this facility</option>
                                            );
                                        })()}
                                    </select>
                                )}
                            </div>

                            {extensionFormData.planType !== 'withoutReg' && selectedFacilityFees['registration'] && (
                                <div className="flex items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                                    <input type="checkbox" name="includeRegistration" id="includeReg" checked={extensionFormData.includeRegistration} onChange={handleExtensionInputChange} className="h-4 w-4 text-blue-600 rounded border-gray-300" />
                                    <label htmlFor="includeReg" className="ml-2 block text-sm text-gray-900">
                                        Include Registration Fee
                                        <span className="font-semibold text-blue-700 ml-1">(+₹{targetUser?.gender === 'Male' ? selectedFacilityFees['registration'].price : selectedFacilityFees['registration'].price})</span>
                                    </label>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Expiry Date</label>
                                    <input
                                        type="text"
                                        name="startDate"
                                        value={extensionFormData.startDate ? extensionFormData.startDate.split('-').reverse().join('/') : ''}
                                        readOnly
                                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 ${new Date(extensionFormData.startDate) < new Date().setHours(0, 0, 0, 0) ? 'text-red-600 font-bold border-red-300' : 'text-gray-500'
                                            }`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Expiry Date</label>
                                    <input
                                        type="text"
                                        // Takes YYYY-MM-DD -> Splits to array -> Reverses to DD-MM-YYYY -> Joins with /
                                        value={newCalculatedEndDate !== 'N/A' ? newCalculatedEndDate.split('-').reverse().join('/') : 'N/A'}
                                        disabled
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Payment Section - Always Online */}
                        <div className="mb-6">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Payment Details (Online Only)</h3>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                {loadingQrs ? (
                                    <div className="text-center py-4 text-gray-500">Loading QR Codes...</div>
                                ) : qrCodes.length > 0 ? (
                                    <div className="flex flex-col items-center">
                                        {/* QR Selector */}
                                        <div className="w-full mb-3">
                                            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Scan QR Code</label>
                                            <div className="relative">
                                                <select
                                                    className="w-full appearance-none bg-white border border-gray-300 text-gray-700 py-2 px-3 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm"
                                                    onChange={(e) => {
                                                        const selected = qrCodes.find(qr => qr.id === e.target.value);
                                                        setSelectedQr(selected);
                                                    }}
                                                    value={selectedQr?.id || ''}
                                                >
                                                    {qrCodes.map(qr => (
                                                        <option key={qr.id} value={qr.id}>{qr.name}</option>
                                                    ))}
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                                    <ChevronDown size={14} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* QR Image with Click to Zoom */}
                                        {selectedQr && (
                                            <div className="bg-white p-2 rounded shadow-sm border border-gray-200 mb-4 relative group">
                                                <div className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                    <ZoomIn size={16} />
                                                </div>
                                                <img
                                                    src={selectedQr.imageLink}
                                                    alt={selectedQr.name}
                                                    className="w-40 h-40 object-contain cursor-pointer hover:opacity-95 transition-opacity"
                                                    onClick={() => setShowLargeQr(true)}
                                                    title="Click to expand"
                                                />
                                                <p className="text-xs text-center mt-1 text-gray-500">Click to enlarge</p>
                                            </div>
                                        )}

                                        {/* UTR Input */}
                                        <div className="w-full">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Enter UTR Number *</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 123456789012"
                                                value={utrNumber}
                                                onChange={(e) => setUtrNumber(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Ask user for the transaction reference number.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-red-500 flex flex-col items-center gap-2">
                                        <AlertCircle size={24} />
                                        <p className="text-sm">No QR Codes available. Please upload one in the main settings.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Total to Pay */}
                        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                            <span className="text-gray-600 font-medium">Total to Pay</span>
                            <span className="text-2xl font-bold text-gray-900 flex items-center">
                                <IndianRupee size={20} className="text-gray-400" />{calculatedFee}
                            </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 justify-end">
                            <button onClick={onClose} className="px-5 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                            <button
                                onClick={handleExtendSubscription}
                                disabled={
                                    loading ||
                                    calculatedFee === 0 ||
                                    loadingFees ||
                                    !utrNumber.trim()
                                }
                                className={`px-5 py-2 rounded-lg text-white font-medium flex items-center gap-2 ${loading || calculatedFee === 0 || !utrNumber.trim()
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                            >
                                {loading ? 'Processing...' : 'Record Payment'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* FULL SCREEN QR MODAL */}
            {showLargeQr && selectedQr && (
                <div
                    className="fixed inset-0 z-[60] bg-black bg-opacity-90 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setShowLargeQr(false)}
                >
                    <div className="relative max-w-full max-h-full">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowLargeQr(false);
                            }}
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2"
                        >
                            <X size={32} />
                        </button>
                        <div
                            className="bg-white p-4 rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={selectedQr.imageLink}
                                alt={selectedQr.name}
                                className="max-w-full max-h-[80vh] object-contain"
                            />
                            <p className="text-center font-bold text-lg mt-2">{selectedQr.name}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubscriptionExtensionModal;