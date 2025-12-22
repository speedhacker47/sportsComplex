// src/app/(dashboard)/admin/staff/page.js
'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import AddStaffModal from './AddStaffModal';
import EditStaffModal from './EditStaffModal';
import ResetPasswordModal from './ResetPasswordModal';
import { FiUser, FiMail, FiPhone, FiEdit, FiTrash2, FiKey } from 'react-icons/fi';

export default function AdminStaffPage() {
  const [staff, setStaff] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFacility, setFilterFacility] = useState('all');

  // Fetch staff from Firebase
  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError(null);
      const staffRef = collection(db, 'staff');
      const snapshot = await getDocs(staffRef);
      
      const staffData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setStaff(staffData);
    } catch (err) {
      console.error('Error fetching staff:', err);
      setError('Failed to load staff members. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch facilities for dropdown
  const fetchFacilities = async () => {
    try {
      const facilitiesRef = collection(db, 'facilities');
      const snapshot = await getDocs(facilitiesRef);
      const facilitiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFacilities(facilitiesData);
    } catch (err) {
      console.error('Error fetching facilities:', err);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchFacilities();
  }, []);

  // Handle delete staff
  const handleDelete = async (staffId, staffName) => {
    if (!confirm(`Are you sure you want to delete "${staffName}"? This will also remove their login access.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'staff', staffId));
      setStaff(prev => prev.filter(s => s.id !== staffId));
      alert('Staff member deleted successfully!');
    } catch (err) {
      console.error('Error deleting staff:', err);
      alert('Failed to delete staff member. Please try again.');
    }
  };

  // Handle edit staff
  const handleEdit = (staffMember) => {
    setSelectedStaff(staffMember);
    setShowEditModal(true);
  };

  // Handle reset password
  const handleResetPassword = (staffMember) => {
    setSelectedStaff(staffMember);
    setShowResetPasswordModal(true);
  };

  // Filter staff
  const filteredStaff = staff.filter(member => {
    const matchesSearch = 
      member.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.userId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFacility = filterFacility === 'all' || member.facility === filterFacility;
    
    return matchesSearch && matchesFacility;
  });

  // Statistics
  const activeStaff = staff.filter(s => s.active !== false).length;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading staff members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Staff Management</h1>
          <p className="text-gray-600 mt-1">Manage staff members and their access credentials</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition shadow-md hover:shadow-lg"
        >
          + Add New Staff
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <h3 className="text-gray-600 text-sm font-medium">Total Staff</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">{staff.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <h3 className="text-gray-600 text-sm font-medium">Active Staff</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">{activeStaff}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
          <h3 className="text-gray-600 text-sm font-medium">Facilities Covered</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">
            {new Set(staff.map(s => s.facility)).size}
          </p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by name, email or user ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Facility</label>
            <select
              value={filterFacility}
              onChange={(e) => setFilterFacility(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Facilities</option>
              {facilities.map(facility => (
                <option key={facility.id} value={facility.name}>
                  {facility.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Staff List */}
      {filteredStaff.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-gray-400 mb-4">
            <FiUser className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            {staff.length === 0 ? 'No Staff Members Yet' : 'No Results Found'}
          </h3>
          <p className="text-gray-600 mb-6">
            {staff.length === 0 
              ? 'Get started by adding your first staff member'
              : 'Try adjusting your search or filter criteria'
            }
          </p>
          {staff.length === 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Add Staff Member
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Staff Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Facility
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStaff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">
                          {member.firstName?.[0]}{member.lastName?.[0]}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <FiMail className="w-3 h-3 mr-1" />
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded inline-block">
                      {member.userId}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{member.facility}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center">
                      <FiPhone className="w-3 h-3 mr-1" />
                      {member.contactNumber}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      member.active !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {member.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(member)}
                        className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <FiEdit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleResetPassword(member)}
                        className="text-orange-600 hover:text-orange-900 p-2 hover:bg-orange-50 rounded"
                        title="Reset Password"
                      >
                        <FiKey className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(member.id, `${member.firstName} ${member.lastName}`)}
                        className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Staff Modal */}
      <AddStaffModal
        isOpen={showAddModal}
        facilities={facilities}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          fetchStaff();
        }}
      />

      {/* Edit Staff Modal */}
      {showEditModal && selectedStaff && (
        <EditStaffModal
          isOpen={showEditModal}
          staff={selectedStaff}
          facilities={facilities}
          onClose={() => {
            setShowEditModal(false);
            setSelectedStaff(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedStaff(null);
            fetchStaff();
          }}
        />
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedStaff && (
        <ResetPasswordModal
          isOpen={showResetPasswordModal}
          staff={selectedStaff}
          onClose={() => {
            setShowResetPasswordModal(false);
            setSelectedStaff(null);
          }}
          onSuccess={() => {
            setShowResetPasswordModal(false);
            setSelectedStaff(null);
            fetchStaff();
          }}
        />
      )}
    </div>
  );
}