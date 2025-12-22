// src/app/(dashboard)/admin/staff/AddStaffModal.js
'use client';

import { useState } from 'react';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../../../lib/firebase';
import { FiX, FiEye, FiEyeOff } from 'react-icons/fi';

export default function AddStaffModal({ isOpen, facilities, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    facility: '',
    contactNumber: '',
    email: '',
    password: '',
    active: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [emailGenerated, setEmailGenerated] = useState(false);

  // Generate user ID
  const generateUserId = (firstName, lastName) => {
    const firstPart = firstName.toLowerCase().substring(0, 3);
    const lastPart = lastName.toLowerCase().substring(0, 3);
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${firstPart}${lastPart}${randomNum}`;
  };

  // Check if email exists in Firestore
  const checkEmailExists = async (email) => {
    const staffRef = collection(db, 'staff');
    const q = query(staffRef, where('email', '==', email));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  };

  // Generate unique email from first name
  const generateUniqueEmail = async (firstName) => {
    const baseEmail = `${firstName.toLowerCase()}@raigarh-stadium.com`;
    let email = baseEmail;
    let counter = 1;

    // Keep checking until we find a unique email
    while (await checkEmailExists(email)) {
      email = `${firstName.toLowerCase()}${counter}@raigarh-stadium.com`;
      counter++;
    }

    return email;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Reset email generated flag if first name changes
    if (name === 'firstName' && emailGenerated) {
      setEmailGenerated(false);
      setFormData(prev => ({ ...prev, email: '' }));
    }
  };

  const handleGenerateEmail = async () => {
    if (!formData.firstName) {
      alert('Please enter first name first');
      return;
    }

    setLoading(true);
    try {
      const email = await generateUniqueEmail(formData.firstName);
      setFormData(prev => ({
        ...prev,
        email
      }));
      setEmailGenerated(true);
    } catch (err) {
      console.error('Error generating email:', err);
      alert('Failed to generate email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate form
      if (!formData.firstName || !formData.lastName || !formData.facility || !formData.contactNumber) {
        throw new Error('Please fill in all required fields');
      }

      if (!formData.email) {
        throw new Error('Please generate email first');
      }

      if (!formData.password) {
        throw new Error('Please enter a password');
      }

      if (formData.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const userId = generateUserId(formData.firstName, formData.lastName);
      const facilityId = formData.facility.toLowerCase();

      // Add staff member to Firestore
      await addDoc(collection(db, 'staff'), {
        firstName: formData.firstName,
        lastName: formData.lastName,
        facility: facilityId,
        contactNumber: formData.contactNumber,
        email: formData.email,
        userId: userId,
        active: formData.active,
        firebaseUid: userCredential.user.uid,
        role: 'staff',
        createdAt: new Date().toISOString()
      });

      alert(`Staff member added successfully!\n\nEmail: ${formData.email}\nPassword: ${formData.password}\n\nPlease save these credentials securely.`);
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        facility: '',
        contactNumber: '',
        email: '',
        password: '',
        active: true
      });
      setEmailGenerated(false);

      onSuccess();
    } catch (err) {
      console.error('Error adding staff:', err);
      setError(err.message || 'Failed to add staff member. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Add New Staff Member</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Personal Information */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-3">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={handleChange}
                    placeholder="e.g., +91 98765 43210"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assigned Facility <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="facility"
                    value={formData.facility}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Facility</option>
                    {facilities.map(facility => (
                      <option key={facility.id} value={facility.name}>
                        {facility.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Login Credentials */}
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800">Login Credentials</h3>
                <button
                  type="button"
                  onClick={handleGenerateEmail}
                  disabled={loading || !formData.firstName}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Generate Email
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-100"
                    required
                    readOnly
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {emailGenerated 
                      ? '✓ Email generated and verified as unique'
                      : 'Click "Generate Email" to create email from first name'
                    }
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter password (min 6 characters)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  <p className="text-xs text-red-500 mt-1">⚠️ Save this password securely - it cannot be retrieved later</p>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center">
              <input
                type="checkbox"
                name="active"
                id="active"
                checked={formData.active}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="active" className="ml-2 text-sm text-gray-700">
                Active (Can log in immediately)
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}