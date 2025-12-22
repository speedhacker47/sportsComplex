import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, DollarSign, Banknote, Wifi, AlertCircle, IndianRupee } from 'lucide-react';
import { Timestamp, doc, updateDoc, addDoc, collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const calculateEndDate = (startDate, planType, duration) => {
    if (!startDate) return '';
    const start = new Date(startDate);
    let end = new Date(start);
    if (duration) {
        end.setMonth(end.getMonth() + duration);
    } else {
        switch(planType) {
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
    const [paymentMethod, setPaymentMethod] = useState('Cash'); 
    const [targetSubscriptionId, setTargetSubscriptionId] = useState(null);
    const [currentSubscriptionData, setCurrentSubscriptionData] = useState(null);
    const [extensionFormData, setExtensionFormData] = useState({
        facilityId: '', planType: 'oneMonth',
        startDate: new Date().toISOString().split('T')[0],
        includeRegistration: false,
    });
    const [calculatedFee, setCalculatedFee] = useState(0);
    const [selectedFacilityFees, setSelectedFacilityFees] = useState({});

    // ALL facilities available (no restriction)
    const allowedFacilities = useMemo(() => {
        if (!facilities || facilities.length === 0) return [];
        return facilities; // Show all facilities to everyone
    }, [facilities]);

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

                // Find subscription for this specific facility
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
                setPaymentMethod('Cash');
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

    // Fetch fees when facility changes
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
                
                // Only set planType to first available plan (excluding registration)
                const availablePlans = Object.keys(feesData).filter(key => key !== 'registration');
                if (availablePlans.length > 0 && !availablePlans.includes(extensionFormData.planType)) {
                    setExtensionFormData(prev => ({ ...prev, planType: availablePlans[0] }));
                } else if (availablePlans.length === 0) {
                    // No plans available
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
        let fee = userGender === 'Male' ? feeData.priceMale : feeData.priceFemale;
        if (extensionFormData.includeRegistration && extensionFormData.planType !== 'withoutReg' && selectedFacilityFees['registration']) {
            const regFee = userGender === 'Male' ? selectedFacilityFees['registration'].priceMale : selectedFacilityFees['registration'].priceFemale;
            fee += regFee;
        }
        setCalculatedFee(fee);
    }, [extensionFormData.planType, extensionFormData.includeRegistration, selectedFacilityFees, targetUser?.gender]);

    const handleExtensionInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        // If facility changed, reset subscription fetch
        if (name === 'facilityId') {
            setTargetSubscriptionId(null);
            setCurrentSubscriptionData(null);
            setExtensionFormData(prev => ({ 
                ...prev, 
                [name]: value,
                startDate: new Date().toISOString().split('T')[0]
            }));
            
            // Fetch subscription for new facility
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

    const processDatabaseUpdate = async (actualPaymentMethod, paymentTransactionId = null) => {
        if (!targetUser?.id) throw new Error("User ID missing");
        const feeData = selectedFacilityFees[extensionFormData.planType];
        const duration = feeData?.duration || null;
        const startDateTimestamp = Timestamp.fromDate(new Date(extensionFormData.startDate));
        const endDateTimestamp = Timestamp.fromDate(new Date(calculateEndDate(extensionFormData.startDate, extensionFormData.planType, duration)));

        const paymentData = {
            userId: targetUser.id, amount: calculatedFee, paymentDate: Timestamp.now(),
            method: actualPaymentMethod, transactionId: paymentTransactionId || `MANUAL-${Date.now()}`,
            status: 'completed', facilityId: extensionFormData.facilityId, planType: extensionFormData.planType,
            processedBy: currentStaff.uid || 'system'
        };
        const paymentRef = await addDoc(collection(db, 'payments'), paymentData);

        const subData = {
            facilityId: extensionFormData.facilityId, planType: extensionFormData.planType,
            startDate: startDateTimestamp, endDate: endDateTimestamp, status: 'active',
            updatedAt: Timestamp.now(), lastPaymentId: paymentRef.id,
        };

        if (targetSubscriptionId) {
            const subscriptionRef = doc(db, 'users', targetUser.id, 'subscriptions', targetSubscriptionId);
            await updateDoc(subscriptionRef, {
                ...subData, extendedAt: Timestamp.now(), extendedBy: currentStaff.uid || 'system'
            });
        } else {
            await addDoc(collection(db, 'users', targetUser.id, 'subscriptions'), {
                ...subData, userId: targetUser.id, createdAt: Timestamp.now(),
                createdBy: currentStaff.uid || 'system'
            });
        }
    };

    const handleExtendSubscription = async () => {
        setLoading(true);
        if (!extensionFormData.facilityId || !extensionFormData.planType || !extensionFormData.startDate) {
            setAlert({ show: true, type: 'error', message: 'Please fill all required fields.' });
            setLoading(false);
            return;
        }

        try {
            if (paymentMethod === 'Online') {
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
                                                        {value.title || key} - ₹{targetUser?.gender === 'Male' ? value.priceMale : value.priceFemale}
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
                                        <span className="font-semibold text-blue-700 ml-1">(+₹{targetUser?.gender === 'Male' ? selectedFacilityFees['registration'].priceMale : selectedFacilityFees['registration'].priceFemale})</span>
                                    </label>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Start Date</label>
                                    <input type="date" name="startDate" value={extensionFormData.startDate} onChange={handleExtensionInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New End Date</label>
                                    <input type="text" value={newCalculatedEndDate !== 'N/A' ? new Date(newCalculatedEndDate).toLocaleDateString('en-GB') : 'N/A'} disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500" />
                                </div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button type="button" onClick={() => setPaymentMethod('Cash')} className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-lg transition-all ${paymentMethod === 'Cash' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                                    <Banknote size={20} /> <span className="font-medium">Cash</span>
                                </button>
                                <button type="button" onClick={() => setPaymentMethod('Online')} className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-lg transition-all ${paymentMethod === 'Online' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                                    <Wifi size={20} /> <span className="font-medium">Online</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                            <span className="text-gray-600 font-medium">Total to Pay</span>
                            <span className="text-2xl font-bold text-gray-900 flex items-center">
                                <IndianRupee size={20} className="text-gray-400" />{calculatedFee}
                            </span>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button onClick={onClose} className="px-5 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                            <button onClick={handleExtendSubscription} disabled={loading || calculatedFee === 0 || loadingFees} className={`px-5 py-2 rounded-lg text-white font-medium flex items-center gap-2 ${loading || calculatedFee === 0 ? 'bg-gray-400 cursor-not-allowed' : paymentMethod === 'Online' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}>
                                {loading ? 'Processing...' : (paymentMethod === 'Online' ? 'Pay & Extend' : 'Record Payment')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SubscriptionExtensionModal;