// src/app/(dashboard)/admin/facilities/page.js
'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import AddFacilityModal from './AddFacilityModal';
import EditFacilityModal from './EditFacilityModal';

// Helper function to format fee display for different structures
const formatFeeDisplay = (fee) => {
  if (!fee) return null;
  
  if (fee.priceAdult !== undefined || fee.priceChild !== undefined) {
    return `A: ₹${fee.priceAdult || 0} / C: ₹${fee.priceChild || 0}`;
  } else if (fee.priceWithTraining !== undefined || fee.priceWithoutTraining !== undefined) {
    return `W Training: ₹${fee.priceWithTraining || 0} / W/o Training: ₹${fee.priceWithoutTraining || 0}`;
  } else if (fee.price !== undefined || fee.price !== undefined) {
    return `M: ₹${fee.price || 0} / F: ₹${fee.price || 0}`;
  }
  
  return null;
};

// Get readable plan names
const getPlanName = (planKey) => {
  const planNames = {
    registration: 'Registration',
    guest: 'Guest',
    training: 'Training',
    oneMonth: '1 Month',
    threeMonth: '3 Months',
    sixMonth: '6 Months',
    year: 'Yearly',
    withoutReg: 'Without Reg'
  };
  return planNames[planKey] || planKey;
};

export default function AdminFacilitiesPage() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [error, setError] = useState(null);

  // Fetch facilities from Firebase with fees
  const fetchFacilities = async () => {
    try {
      setLoading(true);
      setError(null);
      const facilitiesRef = collection(db, 'facilities');
      const snapshot = await getDocs(facilitiesRef);
      
      const facilitiesData = await Promise.all(
        snapshot.docs.map(async (facilityDoc) => {
          const facilityData = {
            id: facilityDoc.id,
            ...facilityDoc.data()
          };

          // Fetch fees subcollection
          const feesRef = collection(db, 'facilities', facilityDoc.id, 'fees');
          const feesSnapshot = await getDocs(feesRef);
          
          facilityData.fees = {};
          feesSnapshot.docs.forEach(feeDoc => {
            facilityData.fees[feeDoc.id] = feeDoc.data();
          });

          return facilityData;
        })
      );
      
      setFacilities(facilitiesData);
    } catch (err) {
      console.error('Error fetching facilities:', err);
      setError('Failed to load facilities. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacilities();
  }, []);

  // Handle delete facility
  const handleDelete = async (facilityId, facilityName) => {
    if (!confirm(`Are you sure you want to delete "${facilityName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'facilities', facilityId));
      setFacilities(prev => prev.filter(f => f.id !== facilityId));
      alert('Facility deleted successfully!');
    } catch (err) {
      console.error('Error deleting facility:', err);
      alert('Failed to delete facility. Please try again.');
    }
  };

  // Handle edit facility
  const handleEdit = (facility) => {
    setSelectedFacility(facility);
    setShowEditModal(true);
  };

  // Statistics calculations
  const activeFacilities = facilities.filter(f => f.active).length;
  const inactiveFacilities = facilities.filter(f => !f.active).length;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading facilities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Facilities Management</h1>
          <p className="text-gray-600 mt-1">Manage all stadium facilities and their details</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition shadow-md hover:shadow-lg"
        >
          + Add New Facility
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Facilities Grid */}
      {facilities.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No Facilities Yet</h3>
          <p className="text-gray-600 mb-6">Get started by adding your first facility</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Add Facility
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {facilities.map((facility) => (
            <div key={facility.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow">
              {/* Facility Image */}
              <div className="h-48 bg-gray-200 relative overflow-hidden">
                {facility.image ? (
                  <img
                    src={facility.image}
                    alt={facility.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/400x300?text=No+Image';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-300">
                    <span className="text-gray-500">No Image</span>
                  </div>
                )}
                
                {/* Status Badge */}
                <div className="absolute top-3 right-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    facility.active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {facility.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Facility Details */}
              <div className="p-5">
                <h3 className="text-xl font-bold text-gray-800 mb-2">{facility.name}</h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{facility.description}</p>

                {/* Pricing - Dynamic display based on fee structure */}
                {facility.fees && Object.keys(facility.fees).length > 0 && (
                  <div className="mb-4 space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Subscription Plans:</h4>
                    
                    {Object.entries(facility.fees)
                      .sort((a, b) => {
                        const order = ['registration', 'guest', 'training', 'oneMonth', 'threeMonth', 'sixMonth', 'year', 'withoutReg'];
                        return order.indexOf(a[0]) - order.indexOf(b[0]);
                      })
                      .map(([planKey, planData]) => {
                        const displayText = formatFeeDisplay(planData);
                        if (!displayText) return null;
                        
                        return (
                          <div key={planKey} className="text-sm">
                            <span className="text-gray-600">{getPlanName(planKey)}:</span>
                            <span className="ml-2 font-semibold text-gray-800">
                              {displayText}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Coach Information */}
                {facility.coach && facility.coach.name && (
                  <div className="mb-4 pb-4 border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Coach:</h4>
                    <div className="text-sm text-gray-600">
                      <p className="font-medium">{facility.coach.name}</p>
                      {facility.coach.contact && (
                        <p className="text-gray-500">{facility.coach.contact}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => handleEdit(facility)}
                    className="flex-1 bg-blue-50 text-blue-600 py-2 px-4 rounded-lg hover:bg-blue-100 transition font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(facility.id, facility.name)}
                    className="flex-1 bg-red-50 text-red-600 py-2 px-4 rounded-lg hover:bg-red-100 transition font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Facility Modal */}
      <AddFacilityModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          fetchFacilities();
        }}
      />

      {/* Edit Facility Modal */}
      {showEditModal && selectedFacility && (
        <EditFacilityModal
          isOpen={showEditModal}
          facility={selectedFacility}
          onClose={() => {
            setShowEditModal(false);
            setSelectedFacility(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedFacility(null);
            fetchFacilities();
          }}
        />
      )}
    </div>
  );
}