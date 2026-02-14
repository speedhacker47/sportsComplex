// --- START OF FILE PaymentReceiptModal.js ---
import React, { useRef, useState, useEffect } from 'react'; // Added useState, useEffect
import { X, Printer, CheckCircle, Clock, Check } from 'lucide-react'; // Added Check icon
import { doc, updateDoc } from 'firebase/firestore'; // Added Firestore imports
import { db } from '../../../lib/firebase'; // Added db import

const PaymentReceiptModal = ({ isOpen, onClose, data }) => {
  const printRef = useRef();
  const [currentStatus, setCurrentStatus] = useState(data?.status || 'pending');
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (data) setCurrentStatus(data.status);
  }, [data]);

  if (!isOpen || !data) return null;

  const handleApprove = async () => {
    if (!data.paymentId) return alert("Payment ID missing");
    
    if(!window.confirm("Confirm approval of this transaction?")) return;

    setApproving(true);
    try {
      const paymentRef = doc(db, 'payments', data.paymentId);
      await updateDoc(paymentRef, { status: 'completed' });
      setCurrentStatus('completed'); // Update local state for UI/Print
    } catch (error) {
      console.error("Error approving:", error);
      alert("Failed to approve");
    } finally {
      setApproving(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const originalContents = document.body.innerHTML;

    // Create a print window style
    const printStyle = `
      <style>
        @media print {
          body { -webkit-print-color-adjust: exact; }
          @page { size: auto; margin: 0mm; }
          .no-print { display: none !important; }
        }
      </style>
    `;

    // Simple print approach: replace body, print, restore (standard SPA print trick)
    // Or better: Use a hidden iframe or specific print media CSS queries.
    // For simplicity in this stack, we will use a print-specific class wrapper.
    
    document.body.innerHTML = printContent + printStyle;
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload(); // Reload to restore event listeners lost by innerHTML replacement
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col">
        
        {/* Modal Header (No Print) */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Payment Receipt</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Action Buttons (No Print) */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
           {/* New Approve Button */}
           {currentStatus === 'pending' && (
            <button 
              onClick={handleApprove}
              disabled={approving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Check size={18} /> {approving ? 'Approving...' : 'Approve Transaction'}
            </button>
          )}

          <button 
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-white transition-colors"
          >
            Close
          </button>
          <button 
            onClick={handlePrint}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 transition-colors"
          >
            <Printer size={18} /> Print Receipt
          </button>
        </div>

        {/* Printable Area */}
        <div ref={printRef} className="p-8 bg-white" id="receipt-content">
          <div className="border-2 border-gray-800 p-6 rounded-lg">
            {/* Receipt Header */}
            <div className="text-center mb-6 border-b-2 border-gray-200 pb-4">
              <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wider">PAYMENT RECEIPT</h1>
              <p className="text-sm text-gray-500 mt-1">{data.organizationName || 'Raigarh Stadium Samiti'}</p>
              <p className="text-xs text-gray-400">{new Date().toLocaleDateString()}</p>
            </div>

            {/* Receipt Details */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Transaction ID (UTR):</span>
                <span className="font-mono font-bold text-gray-900">{data.transactionId || 'N/A'}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Date:</span>
                <span className="font-semibold text-gray-900">{data.paymentDate}</span>
              </div>

              <div className="my-2 border-t border-dashed border-gray-300"></div>

              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-semibold text-gray-900 capitalize">{data.userName}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Reg Number:</span>
                <span className="font-semibold text-gray-900">{data.regNumber}</span>
              </div>

              <div className="my-2 border-t border-dashed border-gray-300"></div>

              <div className="flex justify-between">
                <span className="text-gray-600">Facility:</span>
                <span className="font-semibold text-gray-900">{data.facilityName}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Plan:</span>
                <span className="font-semibold text-gray-900">{data.planType}</span>
              </div>

              {currentStatus === 'pending' && (
                <div className="flex justify-between items-center bg-yellow-50 p-2 rounded mt-2">
                  <span className="text-yellow-800 font-medium flex items-center gap-1">
                    <Clock size={14} /> Status:
                  </span>
                  <span className="text-yellow-800 font-bold uppercase">Pending Verification</span>
                </div>
              )}
               {currentStatus === 'completed' && (
                <div className="flex justify-between items-center bg-green-50 p-2 rounded mt-2">
                  <span className="text-green-800 font-medium flex items-center gap-1">
                    <CheckCircle size={14} /> Status:
                  </span>
                  <span className="text-green-800 font-bold uppercase">Paid</span>
                </div>
              )}

              <div className="my-4 border-t-2 border-gray-800"></div>

              <div className="flex justify-between items-center text-lg">
                <span className="font-bold text-gray-900">Total Amount:</span>
                <span className="font-bold text-blue-600">₹{data.amount}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-xs text-gray-400">
              <p>This is a computer generated receipt.</p>
              <p>Thank you for your payment.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons (No Print) */}
       
      </div>
    </div>
  );
};

export default PaymentReceiptModal;