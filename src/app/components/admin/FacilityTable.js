// src/app/components/admin/FacilityTable.js
'use client';

export default function FacilityTable({ facilities, onEdit, onDelete }) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold">Facility</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Type</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Capacity</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Price/Hour</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {facilities.map((facility) => (
              <tr key={facility.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    facility.status === 'Active' 
                      ? 'bg-green-100 text-green-800'
                      : facility.status === 'Maintenance'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {facility.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-700 font-semibold">₹{facility.pricePerHour}</td>
                <td className="px-6 py-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onEdit(facility)}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(facility.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}