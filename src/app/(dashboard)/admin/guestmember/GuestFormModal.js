import React from 'react';
import { X, User, Phone, CreditCard, Calendar, QrCode, ChevronDown, ZoomIn } from 'lucide-react';

const GuestFormModal = ({
    isOpen, onClose, formData, handleInputChange, handleSubmit, loading,
    facilities, selectedFacility, calculatedFee, qrCodes, isExistingGuest
}) => {
    if (!isOpen) return null;

    // Local state for image zoom
    const [showLargeQr, setShowLargeQr] = React.useState(false);
    const selectedQrObj = qrCodes.find(q => q.id === formData.qrCodeId);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-gray-900">
                        {isExistingGuest ? 'New Booking for Guest' : 'Register Guest'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User size={18} className="text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    disabled={isExistingGuest} // Lock name if existing
                                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter guest name"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Phone size={18} className="text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    name="mobile"
                                    value={formData.mobile}
                                    onChange={handleInputChange}
                                    disabled={isExistingGuest} // Lock mobile if existing
                                    maxLength="10"
                                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="10-digit mobile"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Facility & Plan Selection */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Calendar size={18} /> Booking Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Facility *</label>
                                <select
                                    name="facilityId"
                                    value={formData.facilityId}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">-- Choose Facility --</option>
                                    {facilities.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Type *</label>
                                <select
                                    name="planType"
                                    value={formData.planType}
                                    onChange={handleInputChange}
                                    disabled={!selectedFacility}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    {selectedFacility?.fees ? (
                                        Object.entries(selectedFacility.fees)
                                            .map(([key, value]) => (
                                                <option key={key} value={key}>
                                                    {value.title || key} - ₹{value.price}
                                                </option>
                                            ))
                                    ) : (
                                        <option value="">Select facility first</option>
                                    )}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    name="startDate"
                                    value={formData.startDate}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Payment Section */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                            <CreditCard size={18} /> Payment Information
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Amount Display */}
                            <div className="flex flex-col justify-center">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Total Payable</label>
                                <div className="text-3xl font-bold text-blue-600">₹{calculatedFee}</div>
                            </div>

                            {/* QR & UTR */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Scan QR Code</label>
                                    <div className="relative">
                                        <select 
                                            name="qrCodeId"
                                            value={formData.qrCodeId}
                                            onChange={handleInputChange}
                                            className="w-full appearance-none bg-white border border-gray-300 text-gray-700 py-2 px-3 pr-8 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Select QR Code</option>
                                            {qrCodes.map(qr => (
                                                <option key={qr.id} value={qr.id}>{qr.name}</option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                            <ChevronDown size={14} />
                                        </div>
                                    </div>
                                    
                                    {/* QR Preview Thumbnail */}
                                    {selectedQrObj && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <div className="relative group cursor-pointer" onClick={() => setShowLargeQr(true)}>
                                                <img 
                                                    src={selectedQrObj.imageLink} 
                                                    alt="QR" 
                                                    className="w-16 h-16 object-contain border rounded bg-white"
                                                />
                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 rounded transition-opacity">
                                                    <ZoomIn size={12} className="text-white" />
                                                </div>
                                            </div>
                                            <span className="text-xs text-gray-500">Click to enlarge</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">UTR / Ref Number *</label>
                                    <input
                                        type="text"
                                        name="utrNumber"
                                        value={formData.utrNumber}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                                        placeholder="e.g. 123456789"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 sticky bottom-0 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || calculatedFee === 0 || !formData.utrNumber || !formData.qrCodeId}
                        className={`px-6 py-2 rounded-lg text-white font-medium flex items-center gap-2 ${
                            loading || calculatedFee === 0 || !formData.utrNumber || !formData.qrCodeId
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {loading ? 'Processing...' : (isExistingGuest ? 'Confirm Booking' : 'Register & Pay')}
                    </button>
                </div>
            </div>

            {/* Large QR Modal */}
            {showLargeQr && selectedQrObj && (
                <div 
                    className="fixed inset-0 z-[60] bg-black bg-opacity-90 flex items-center justify-center p-4"
                    onClick={() => setShowLargeQr(false)}
                >
                    <div className="relative bg-white p-4 rounded-lg">
                        <img src={selectedQrObj.imageLink} alt="QR Large" className="max-h-[80vh] object-contain" />
                        <button className="absolute -top-10 right-0 text-white"><X size={32}/></button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GuestFormModal;