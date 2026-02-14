import React from 'react';
import { CheckCircle, Printer, X, FileText } from 'lucide-react';

const PaymentReceiptModal = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) return null;

  // Function to trigger print window
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt - ${data.invoiceNo}</title>
        <style>
          @page { size: A5; margin: 0; }
          body { font-family: sans-serif; padding: 20px; color: #333; line-height: 1.4; max-width: 148mm; margin: 0 auto; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
          .logo { width: 50px; height: 50px; background: #eee; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #666; overflow: hidden; }
          .logo img { width: 100%; height: 100%; object-fit: contain; }
          .org-info { margin-left: 15px; }
          .org-name { font-size: 16px; font-weight: bold; color: #1e40af; text-transform: uppercase; }
          .reg-num { font-size: 10px; color: #666; }
          .badge { background: #eff6ff; color: #2563eb; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; border: 1px solid #bfdbfe; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
          .row { display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding: 4px 0; }
          .label { font-size: 11px; font-weight: bold; color: #64748b; }
          .value { font-size: 12px; font-weight: 600; color: #0f172a; text-align: right; }
          .total-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
          .total-label { font-weight: bold; color: #1e40af; font-size: 14px; }
          .total-val { font-weight: bold; color: #1e40af; font-size: 20px; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display:flex; align-items:center;">
            <div class="logo"><img src="/raigarh_logo.webp" alt="Logo"/></div>
            <div class="org-info">
              <div class="org-name">Raigarh Stadium Samiti</div>
              <div class="reg-num">Reg: 1737 / 21.04.1997</div>
            </div>
          </div>
          <div style="text-align:right;">
             <div class="badge">RECEIPT</div>
             <div style="font-size:10px; margin-top:4px;">${data.invoiceNo}</div>
          </div>
        </div>

        <div style="margin-bottom: 10px; font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #eee;">Transaction Details</div>

        <div class="grid">
          <div>
            <div class="row"><span class="label">Date</span><span class="value">${data.paymentDate}</span></div>
            <div class="row"><span class="label">Txn ID</span><span class="value" style="font-size:10px;">${data.transactionId}</span></div>
            <div class="row"><span class="label">Status</span><span class="value" style="color:green;">COMPLETED</span></div>
          </div>
          <div>
            <div class="row"><span class="label">Name</span><span class="value">${data.userName}</span></div>
            <div class="row"><span class="label">Reg No</span><span class="value">${data.regNumber || 'GUEST'}</span></div>
            <div class="row"><span class="label">Plan</span><span class="value">${data.planType}</span></div>
          </div>
        </div>

        <div class="row" style="margin-top: 5px;">
           <span class="label">Facility / Purpose</span>
           <span class="value">${data.facilityName}</span>
        </div>

        <div class="total-box">
          <span class="total-label">TOTAL PAID</span>
          <span class="total-val">₹${data.amount}</span>
        </div>

        <div style="margin-top: 30px; display: flex; justify-content: flex-end;">
            <div style="text-align: center; width: 120px;">
                <div style="border-bottom: 1px solid #333; height: 30px; margin-bottom: 5px;"></div>
                <div style="font-size: 9px; font-weight: bold;">Authorized Signatory</div>
            </div>
        </div>

        <div class="footer">
          <p>System Generated Receipt. Raigarh Stadium Samiti.</p>
        </div>
        <script>
           window.onload = function() { window.print(); window.onafterprint = function() { window.close(); } };
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="text-green-600 w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Payment Successful!</h2>
          <p className="text-sm text-gray-500 mt-1">Receipt #{data.invoiceNo}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Amount Paid</span>
            <span className="font-bold text-gray-900 text-lg">₹{data.amount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Guest / Member</span>
            <span className="font-medium text-gray-900 text-right truncate max-w-[150px]">{data.userName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Transaction ID</span>
            <span className="font-mono text-gray-900 text-xs">{data.transactionId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Facility</span>
            <span className="font-medium text-blue-600">{data.facilityName}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={onClose} 
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Close
          </button>
          <button 
            onClick={handlePrint} 
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Printer size={18} /> Print
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentReceiptModal;