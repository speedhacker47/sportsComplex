// src/app/(dashboard)/admin/facilities/EditFacilityModal.js
'use client';
import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { doc, updateDoc, serverTimestamp, collection, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const EditFacilityModal = ({ isOpen, onClose, onSuccess, facility }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    coachName: '',
    coachContact: '',
    active: true,
  });
  
  const [fees, setFees] = useState({});
  const [feeStructureType, setFeeStructureType] = useState('gym'); // 'gym' or 'swimming'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Detect fee structure type and populate form
  useEffect(() => {
    if (facility) {
      setFormData({
        name: facility.name || '',
        description: facility.description || '',
        image: facility.image || '',
        coachName: facility.coach?.name || '',
        coachContact: facility.coach?.contact || '',
        active: facility.active !== undefined ? facility.active : true,
      });

      // Detect structure type based on existing fees
      if (facility.fees && Object.keys(facility.fees).length > 0) {
        const firstFee = Object.values(facility.fees)[0];
        
        if (firstFee.priceAdult !== undefined || firstFee.priceChild !== undefined) {
          setFeeStructureType('swimming');
        } else if (firstFee.priceMale !== undefined || firstFee.priceFemale !== undefined) {
          setFeeStructureType('gym');
        } else if (firstFee.priceWithTraining !== undefined || firstFee.priceWithoutTraining !== undefined) {
          setFeeStructureType('swimming');
        }
      }

      // Load existing fees
      if (facility.fees) {
        setFees(facility.fees);
      }
    }
  }, [facility]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFeeChange = (planType, field, value) => {
    setFees(prev => ({
      ...prev,
      [planType]: {
        ...prev[planType],
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const coach = {
        name: formData.coachName || '',
      };
      if (formData.coachContact) {
        coach.contact = formData.coachContact;
      }

      const facilityUpdate = {
        name: formData.name,
        description: formData.description,
        image: formData.image,
        coach,
        active: formData.active,
        updatedAt: serverTimestamp(),
      };

      const facilityRef = doc(db, 'facilities', facility.id);
      await updateDoc(facilityRef, facilityUpdate);

      // Update fees subcollection
      const feesCollectionRef = collection(facilityRef, 'fees');
      
      for (const [planType, feeData] of Object.entries(fees)) {
        if (feeData && feeData.title) {
          const feeDoc = {
            title: feeData.title,
            description: feeData.description || '',
            duration: Number(feeData.duration) || 0,
          };

          // Add price fields based on what exists in the data
          if (feeData.priceMale !== undefined) feeDoc.priceMale = Number(feeData.priceMale) || 0;
          if (feeData.priceFemale !== undefined) feeDoc.priceFemale = Number(feeData.priceFemale) || 0;
          if (feeData.priceAdult !== undefined) feeDoc.priceAdult = Number(feeData.priceAdult) || 0;
          if (feeData.priceChild !== undefined) feeDoc.priceChild = Number(feeData.priceChild) || 0;
          if (feeData.priceWithTraining !== undefined) feeDoc.priceWithTraining = Number(feeData.priceWithTraining) || 0;
          if (feeData.priceWithoutTraining !== undefined) feeDoc.priceWithoutTraining = Number(feeData.priceWithoutTraining) || 0;

          await setDoc(doc(feesCollectionRef, planType), feeDoc);
        }
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error updating facility:', err);
      setError('Failed to update facility. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderFeeFields = (planType, planTitle) => {
    const feeData = fees[planType] || {};
    
    // Determine which price fields to show
    const hasAdultChild = feeData.priceAdult !== undefined || feeData.priceChild !== undefined;
    const hasTraining = feeData.priceWithTraining !== undefined || feeData.priceWithoutTraining !== undefined;
    const hasMaleFemale = feeData.priceMale !== undefined || feeData.priceFemale !== undefined;

    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-800 mb-3">{planTitle}</h4>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan Title
            </label>
            <input
              type="text"
              placeholder={`e.g., ${planTitle}`}
              value={feeData.title || ''}
              onChange={(e) => handleFeeChange(planType, 'title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan Description
            </label>
            <input
              type="text"
              placeholder="Description"
              value={feeData.description || ''}
              onChange={(e) => handleFeeChange(planType, 'description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Adult/Child Pricing (Swimming - Year, Training, Guest) */}
          {(hasAdultChild || feeStructureType === 'swimming') && !hasTraining && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price for Adult
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={feeData.priceAdult || ''}
                  onChange={(e) => handleFeeChange(planType, 'priceAdult', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price for Child
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={feeData.priceChild || ''}
                  onChange={(e) => handleFeeChange(planType, 'priceChild', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* With/Without Training Pricing (Swimming - Monthly Plans) */}
          {(hasTraining || (feeStructureType === 'swimming' && !hasAdultChild && planType !== 'registration')) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price With Training
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={feeData.priceWithTraining || ''}
                  onChange={(e) => handleFeeChange(planType, 'priceWithTraining', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price Without Training
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={feeData.priceWithoutTraining || ''}
                  onChange={(e) => handleFeeChange(planType, 'priceWithoutTraining', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Male/Female Pricing (Gym) */}
          {(hasMaleFemale || (feeStructureType === 'gym' && !hasAdultChild && !hasTraining)) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price for Male
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={feeData.priceMale || ''}
                  onChange={(e) => handleFeeChange(planType, 'priceMale', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price for Female
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={feeData.priceFemale || ''}
                  onChange={(e) => handleFeeChange(planType, 'priceFemale', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  // Get all existing fee plan types from the facility
  const existingPlans = fees ? Object.keys(fees) : [];
  const commonPlans = ['registration', 'guest', 'training', 'oneMonth', 'threeMonth', 'sixMonth', 'year', 'withoutReg'];
  const allPlans = [...new Set([...existingPlans, ...commonPlans])];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-800">Edit Facility</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Facility Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image URL *
              </label>
              <input
                type="url"
                name="image"
                value={formData.image}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Coach Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Coach Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coach Name
                </label>
                <input
                  type="text"
                  name="coachName"
                  value={formData.coachName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coach Contact
                </label>
                <input
                  type="tel"
                  name="coachContact"
                  value={formData.coachContact}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Fee Plans */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">Subscription Plans</h3>
              <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded">
                Type: {feeStructureType === 'swimming' ? 'Swimming' : 'Gym'}
              </span>
            </div>
            
            {allPlans.map(planType => {
              const planTitles = {
                registration: 'Registration Fee',
                guest: 'Guest Pass',
                training: 'Training',
                oneMonth: 'One Month Subscription',
                threeMonth: 'Three Month Subscription',
                sixMonth: 'Six Month Subscription',
                year: 'Yearly Subscription',
                withoutReg: 'Without Registration'
              };
              
              // Only render if the plan exists in fees or is a common plan
              if (fees[planType] || commonPlans.includes(planType)) {
                return (
                  <div key={planType}>
                    {renderFeeFields(planType, planTitles[planType] || planType)}
                  </div>
                );
              }
              return null;
            })}
          </div>

          {/* Active Status */}
          <div className="flex items-center">
            <input
              type="checkbox"
              name="active"
              checked={formData.active}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700">
              Active (visible to users)
            </label>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Facility'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditFacilityModal;

// Helper function to format fee display
export const formatFeeDisplay = (fee) => {
  if (!fee) return null;
  
  const parts = [];
  
  if (fee.priceAdult !== undefined && fee.priceChild !== undefined) {
    parts.push(`Adult: ₹${fee.priceAdult}`);
    parts.push(`Child: ₹${fee.priceChild}`);
  } else if (fee.priceWithTraining !== undefined && fee.priceWithoutTraining !== undefined) {
    parts.push(`With Training: ₹${fee.priceWithTraining}`);
    parts.push(`Without: ₹${fee.priceWithoutTraining}`);
  } else if (fee.priceMale !== undefined && fee.priceFemale !== undefined) {
    parts.push(`M: ₹${fee.priceMale}`);
    parts.push(`F: ₹${fee.priceFemale}`);
  }
  
  return parts.length > 0 ? parts.join(' / ') : null;
};