// src/components/admin/AddFacilityModal.js
'use client';
import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const AddFacilityModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    coachName: '',
    coachContact: '',
    active: true,
  });
  
  const [fees, setFees] = useState({
    oneMonth: { title: '', description: '', duration: 1, priceMale: '', priceFemale: '' },
    threeMonth: { title: '', description: '', duration: 3, priceMale: '', priceFemale: '' },
    sixMonth: { title: '', description: '', duration: 6, priceMale: '', priceFemale: '' },
    year: { title: '', description: '', duration: 12, priceMale: '', priceFemale: '' },
    withoutReg: { title: '', description: '', duration: 1, priceMale: '', priceFemale: '' },
    registration: { title: '', description: '', duration: 0, priceMale: '', priceFemale: '' },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      // Generate facility ID from name (lowercase, replace spaces with hyphens)
      const facilityId = formData.name.toLowerCase().replace(/\s+/g, '-');

      // Build coach object
      const coach = {
        name: formData.coachName || '',
      };
      if (formData.coachContact) {
        coach.contact = formData.coachContact;
      }

      // Build fees subcollection data
      const feesData = {};
      Object.keys(fees).forEach(planType => {
        const fee = fees[planType];
        if (fee.title && (fee.priceMale || fee.priceFemale)) {
          feesData[planType] = {
            title: fee.title,
            description: fee.description || '',
            duration: Number(fee.duration) || 0,
            priceMale: Number(fee.priceMale) || 0,
            priceFemale: Number(fee.priceFemale) || 0,
          };
        }
      });

      // Prepare facility document
      const facilityDoc = {
        name: formData.name,
        description: formData.description,
        image: formData.image,
        coach,
        active: formData.active,
        createdAt: serverTimestamp(),
      };

      // Add facility to Firestore
      const facilityRef = doc(db, 'facilities', facilityId);
      await setDoc(facilityRef, facilityDoc);

      // Add fees as subcollection documents
      const feesCollectionRef = collection(facilityRef, 'fees');
      for (const [planType, feeData] of Object.entries(feesData)) {
        await setDoc(doc(feesCollectionRef, planType), feeData);
      }

      // Reset form
      setFormData({
        name: '',
        description: '',
        image: '',
        coachName: '',
        coachContact: '',
        active: true,
      });
      setFees({
        oneMonth: { title: '', description: '', duration: 1, priceMale: '', priceFemale: '' },
        threeMonth: { title: '', description: '', duration: 3, priceMale: '', priceFemale: '' },
        sixMonth: { title: '', description: '', duration: 6, priceMale: '', priceFemale: '' },
        year: { title: '', description: '', duration: 12, priceMale: '', priceFemale: '' },
        withoutReg: { title: '', description: '', duration: 1, priceMale: '', priceFemale: '' },
        registration: { title: '', description: '', duration: 0, priceMale: '', priceFemale: '' },
      });

      // Call success callback
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error adding facility:', err);
      setError('Failed to add facility. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-800">Add New Facility</h2>
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
                placeholder="e.g., Gym, Cricket, Badminton"
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
                placeholder="Describe the facility..."
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
                placeholder="https://example.com/image.jpg"
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
                  placeholder="e.g., Rahul Dravid"
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
                  placeholder="e.g., +919876543210"
                />
              </div>
            </div>
          </div>

          {/* Fee Plans */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Subscription Plans</h3>
            
            {/* Registration Fee */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-3">Registration Fee</h4>
              <div className="grid grid-cols-1 gap-3">
                <input
                  type="text"
                  placeholder="Title (e.g., Registration Fee)"
                  value={fees.registration.title}
                  onChange={(e) => handleFeeChange('registration', 'title', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={fees.registration.description}
                  onChange={(e) => handleFeeChange('registration', 'description', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Price (Male)"
                    value={fees.registration.priceMale}
                    onChange={(e) => handleFeeChange('registration', 'priceMale', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Price (Female)"
                    value={fees.registration.priceFemale}
                    onChange={(e) => handleFeeChange('registration', 'priceFemale', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* One Month */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-3">One Month Subscription</h4>
              <div className="grid grid-cols-1 gap-3">
                <input
                  type="text"
                  placeholder="Title (e.g., One Month Subscription)"
                  value={fees.oneMonth.title}
                  onChange={(e) => handleFeeChange('oneMonth', 'title', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={fees.oneMonth.description}
                  onChange={(e) => handleFeeChange('oneMonth', 'description', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Price (Male)"
                    value={fees.oneMonth.priceMale}
                    onChange={(e) => handleFeeChange('oneMonth', 'priceMale', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Price (Female)"
                    value={fees.oneMonth.priceFemale}
                    onChange={(e) => handleFeeChange('oneMonth', 'priceFemale', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Three Month */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-3">Three Month Subscription</h4>
              <div className="grid grid-cols-1 gap-3">
                <input
                  type="text"
                  placeholder="Title"
                  value={fees.threeMonth.title}
                  onChange={(e) => handleFeeChange('threeMonth', 'title', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={fees.threeMonth.description}
                  onChange={(e) => handleFeeChange('threeMonth', 'description', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Price (Male)"
                    value={fees.threeMonth.priceMale}
                    onChange={(e) => handleFeeChange('threeMonth', 'priceMale', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Price (Female)"
                    value={fees.threeMonth.priceFemale}
                    onChange={(e) => handleFeeChange('threeMonth', 'priceFemale', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Six Month */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-3">Six Month Subscription</h4>
              <div className="grid grid-cols-1 gap-3">
                <input
                  type="text"
                  placeholder="Title"
                  value={fees.sixMonth.title}
                  onChange={(e) => handleFeeChange('sixMonth', 'title', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={fees.sixMonth.description}
                  onChange={(e) => handleFeeChange('sixMonth', 'description', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Price (Male)"
                    value={fees.sixMonth.priceMale}
                    onChange={(e) => handleFeeChange('sixMonth', 'priceMale', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Price (Female)"
                    value={fees.sixMonth.priceFemale}
                    onChange={(e) => handleFeeChange('sixMonth', 'priceFemale', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Yearly */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-3">Yearly Subscription</h4>
              <div className="grid grid-cols-1 gap-3">
                <input
                  type="text"
                  placeholder="Title"
                  value={fees.year.title}
                  onChange={(e) => handleFeeChange('year', 'title', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={fees.year.description}
                  onChange={(e) => handleFeeChange('year', 'description', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Price (Male)"
                    value={fees.year.priceMale}
                    onChange={(e) => handleFeeChange('year', 'priceMale', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Price (Female)"
                    value={fees.year.priceFemale}
                    onChange={(e) => handleFeeChange('year', 'priceFemale', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Without Registration */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-3">Without Registration</h4>
              <div className="grid grid-cols-1 gap-3">
                <input
                  type="text"
                  placeholder="Title"
                  value={fees.withoutReg.title}
                  onChange={(e) => handleFeeChange('withoutReg', 'title', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={fees.withoutReg.description}
                  onChange={(e) => handleFeeChange('withoutReg', 'description', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Price (Male)"
                    value={fees.withoutReg.priceMale}
                    onChange={(e) => handleFeeChange('withoutReg', 'priceMale', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Price (Female)"
                    value={fees.withoutReg.priceFemale}
                    onChange={(e) => handleFeeChange('withoutReg', 'priceFemale', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
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
              {loading ? 'Adding...' : 'Add Facility'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddFacilityModal;