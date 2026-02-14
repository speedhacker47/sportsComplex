'use client';
import React, { useState } from 'react';
import { User, Calendar, CreditCard, Building2, X, IndianRupee, Save, QrCode, ZoomIn } from 'lucide-react';

const calculateEndDate = (startDate, planType, duration) => {
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

const UserFormModal = ({
  isOpen, onClose, formData, handleInputChange, handleSubmit, loading, facilities,
  selectedFacility, calculatedFee, isEditMode, selectedUser, userSubscriptions, userPayments,
  onExtendSubscriptionClick, qrCodes 
}) => {
  // State for Large QR View
  const [showLargeQr, setShowLargeQr] = useState(false);

  if (!isOpen) return null;

  // ALL facilities available to everyone
  const allowedFacilities = facilities;

  // Group subscriptions by facility
  const subscriptionsByFacility = {};
  if (isEditMode && userSubscriptions) {
    userSubscriptions.forEach(sub => {
      const facilityId = sub.facilityId;
      if (!subscriptionsByFacility[facilityId]) {
        subscriptionsByFacility[facilityId] = [];
      }
      subscriptionsByFacility[facilityId].push(sub);
    });
  }

  // Find selected QR for display
  const selectedQrObj = !isEditMode && formData.qrCodeId && qrCodes ? qrCodes.find(q => q.id === formData.qrCodeId) : null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditMode ? `Edit User: ${selectedUser?.name}` : 'Register New User'}
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
          </div>

          <div className="p-6">
            {/* Personal Information */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User size={20} />Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Father's Name</label>
                  <input type="text" name="fatherName" value={formData.fatherName} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
                  <input type="tel" name="mobile" value={formData.mobile} onChange={handleInputChange} maxLength="10" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                  <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Number *</label>
                  <input type="text" name="aadharNo" value={formData.aadharNo} onChange={handleInputChange} maxLength="12" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                  <textarea name="address" value={formData.address} onChange={handleInputChange} rows="2" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>
            </div>

          

            {/* Subscription History - Grouped by Facility (Only in Edit Mode) */}
            {isEditMode && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar size={20} />Subscription History (By Facility)
                </h3>
                {userSubscriptions && userSubscriptions.length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(subscriptionsByFacility).map(([facilityId, subs]) => {
                      const facilityName = facilities.find(f => f.id === facilityId)?.name || facilityId;
                      const latestSub = subs[0]; 
                      const isExpired = latestSub.endDate?.toDate() < new Date();
                      
                      return (
                        <div key={facilityId} className="border rounded-lg overflow-hidden">
                          <div className={`px-4 py-3 ${isExpired ? 'bg-red-50 border-b border-red-100' : 'bg-green-50 border-b border-green-100'}`}>
                            <div className="flex justify-between items-center">
                              <h4 className="font-semibold text-gray-900">{facilityName}</h4>
                              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${isExpired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                {isExpired ? 'Expired' : 'Active'}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              Latest: {latestSub.startDate?.toDate().toLocaleDateString('en-GB')} - {latestSub.endDate?.toDate().toLocaleDateString('en-GB')}
                            </div>
                          </div>
                          
                          <div className="max-h-40 overflow-y-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Plan</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Start</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">End</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {subs.map(sub => (
                                  <tr key={sub.id}>
                                    <td className="px-4 py-2 text-sm text-gray-900">{sub.planType}</td>
                                    <td className="px-4 py-2 text-sm text-gray-600">{sub.startDate?.toDate().toLocaleDateString('en-GB')}</td>
                                    <td className="px-4 py-2 text-sm text-gray-600">{sub.endDate?.toDate().toLocaleDateString('en-GB')}</td>
                                    <td className="px-4 py-2">
                                      <span className={`px-2 text-xs font-semibold rounded-full ${sub.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {sub.status || 'active'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500">No subscription history found.</p>
                )}
              </div>
            )}

           {/* Payment History (Only in Edit Mode) */}
{isEditMode && (
  <div className="mb-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <CreditCard size={20} />Payment History
    </h3>
    {userPayments && userPayments.length > 0 ? (
      <div className="overflow-x-auto border rounded-lg max-h-64 overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
          
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
               <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid On</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Txn ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
             
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {userPayments.map(payment => (
              <tr key={payment.id} className="hover:bg-gray-50">

                
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {facilities.find(f => f.id === payment.facilityId)?.name || payment.facilityId || 'N/A'}
                </td>

                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {payment.month}
                  </div>
                </td>

               
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                  {payment.paymentDate?.toDate().toLocaleDateString('en-GB') || 'N/A'}
                </td>
             
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                  ₹{payment.amount}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-gray-500" title={payment.transactionId}>
                  {payment.transactionId ? (
                    <>
                      {payment.transactionId.length > 12 
                        ? `${payment.transactionId.substring(0, 12)}...` 
                        : payment.transactionId}
                    </>
                  ) : '-'}
                </td>

               
               
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="text-gray-500 italic">No payment history found.</p>
    )}
  </div>
)}

            {/* Payment Details (New Registration Only) */}
            {!isEditMode && formData.facilityId && (
              <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <QrCode size={20} />Payment Details
                </h3>
                
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select QR Code *</label>
                      <select 
                        name="qrCodeId" 
                        value={formData.qrCodeId} 
                        onChange={handleInputChange} 
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select QR to Pay</option>
                        {qrCodes && qrCodes.map(qr => (
                          <option key={qr.id} value={qr.id}>{qr.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">UTR Number *</label>
                      <input 
                        type="text" 
                        name="utrNumber" 
                        value={formData.utrNumber} 
                        onChange={handleInputChange} 
                        placeholder="e.g. 123456789012"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>

                    <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200">
                      <span className="text-gray-700">Total Amount:</span>
                      <span className="text-2xl font-bold text-blue-600">₹{calculatedFee}</span>
                    </div>
                  </div>

                  {selectedQrObj && (
                    <div className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-lg shadow-sm w-48 mx-auto md:mx-0">
                      {/* Clickable Image Container */}
                      <div 
                        className="relative group cursor-pointer mb-2"
                        onClick={() => setShowLargeQr(true)}
                        title="Click to enlarge"
                      >
                         {/* Zoom Overlay */}
                         <div className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <ZoomIn size={16} />
                         </div>
                         <img 
                           src={selectedQrObj.imageLink} 
                           alt={selectedQrObj.name} 
                           className="w-32 h-32 object-contain hover:opacity-95 transition-opacity"
                         />
                      </div>
                      <p className="text-xs font-semibold text-gray-600 text-center">{selectedQrObj.name}</p>
                      <p className="text-xs text-blue-500 cursor-pointer mt-1" onClick={() => setShowLargeQr(true)}>Click to enlarge</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 justify-end">
              <button type="button" onClick={onClose} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
              <button 
                type="button" 
                onClick={handleSubmit} 
                className={`px-6 py-2 ${isEditMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2`}
              >
                {loading ? (
                  <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Processing...</>
                ) : (
                  <>{isEditMode ? <Save size={18} /> : <User size={18} />}{isEditMode ? 'Update User' : 'Register User'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FULL SCREEN QR MODAL (Rendered outside the main modal div) */}
      {showLargeQr && selectedQrObj && (
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
                src={selectedQrObj.imageLink} 
                alt={selectedQrObj.name} 
                className="max-w-full max-h-[80vh] object-contain"
              />
              <p className="text-center font-bold text-lg mt-2">{selectedQrObj.name}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserFormModal;