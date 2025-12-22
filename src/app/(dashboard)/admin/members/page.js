// src/app/(dashboard)/admin/members/page.js
'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { FiUser, FiMail, FiPhone, FiTrash2, FiCalendar, FiMapPin, FiEye, FiX, FiCreditCard, FiCheckCircle, FiXCircle } from 'react-icons/fi';

export default function AdminMembersPage() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState('all');
  const [selectedMember, setSelectedMember] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [memberDetails, setMemberDetails] = useState(null);

  // Fetch members from Firebase
  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const membersRef = collection(db, 'users');
      const snapshot = await getDocs(membersRef);
      
      const membersData = await Promise.all(
        snapshot.docs.map(async (memberDoc) => {
          const memberData = {
            id: memberDoc.id,
            ...memberDoc.data()
          };

          // Fetch registration info from registration/all subcollection
          try {
            const registrationAllRef = doc(db, 'users', memberDoc.id, 'registration', 'all');
            const registrationAllDoc = await getDoc(registrationAllRef);
            
            if (registrationAllDoc.exists()) {
              memberData.registration = registrationAllDoc.data();
              console.log('Registration data found for user:', memberDoc.id, registrationAllDoc.data());
            } else {
              console.log('No registration document found for user:', memberDoc.id);
            }
          } catch (err) {
            console.error('Error fetching registration for user:', memberDoc.id, err);
          }

          // Fetch subscriptions for each member
          const subscriptionsRef = collection(db, 'users', memberDoc.id, 'subscriptions');
          const subscriptionsSnapshot = await getDocs(subscriptionsRef);
          
          memberData.subscriptions = subscriptionsSnapshot.docs.map(subDoc => ({
            id: subDoc.id,
            ...subDoc.data()
          }));

          return memberData;
        })
      );
      
      // Sort by registration date (newest first)
      membersData.sort((a, b) => {
        const dateA = a.registration?.regDate;
        const dateB = b.registration?.regDate;
        
        if (dateA && dateB) {
          const parsedA = parseFirestoreDate(dateA);
          const parsedB = parseFirestoreDate(dateB);
          return parsedB - parsedA;
        }
        return 0;
      });
      
      setMembers(membersData);
    } catch (err) {
      console.error('Error fetching members:', err);
      setError('Failed to load members. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // Fetch detailed member info including payment history
  const fetchMemberDetails = async (member) => {
    setModalLoading(true);
    try {
      // Fetch payment history
      const paymentHistory = [];
      
      for (const subscription of member.subscriptions) {
        if (subscription.paymentId) {
          try {
            let paymentDoc;
            
            // Check if it's a Firestore DocumentReference
            if (subscription.paymentId.path) {
              // It's a reference - use getDoc directly on the reference
              paymentDoc = await getDoc(subscription.paymentId);
            } 
            // Fallback: if it's somehow a string path
            else if (typeof subscription.paymentId === 'string') {
              const paymentId = subscription.paymentId.replace(/^\//, '').split('/').pop();
              const paymentRef = doc(db, 'payments', paymentId);
              paymentDoc = await getDoc(paymentRef);
            }
            
            if (paymentDoc && paymentDoc.exists()) {
              paymentHistory.push({
                id: paymentDoc.id,
                ...paymentDoc.data(),
                subscriptionId: subscription.id
              });
            }
          } catch (err) {
            console.error('Error fetching payment for subscription:', subscription.id, err);
          }
        }
      }

      setMemberDetails({
        ...member,
        paymentHistory: paymentHistory.sort((a, b) => {
          const dateA = a.paymentDate ? parseFirestoreDate(a.paymentDate) : new Date(0);
          const dateB = b.paymentDate ? parseFirestoreDate(b.paymentDate) : new Date(0);
          return dateB - dateA;
        })
      });
    } catch (err) {
      console.error('Error fetching member details:', err);
    } finally {
      setModalLoading(false);
    }
  };

  // Handle view member
  const handleViewMember = (member) => {
    setSelectedMember(member);
    fetchMemberDetails(member);
  };

  // Handle delete member
  const handleDelete = async (memberId, memberName) => {
    if (!confirm(`Are you sure you want to delete "${memberName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', memberId));
      setMembers(prev => prev.filter(m => m.id !== memberId));
      alert('Member deleted successfully!');
    } catch (err) {
      console.error('Error deleting member:', err);
      alert('Failed to delete member. Please try again.');
    }
  };

  // Filter members
  const filteredMembers = members.filter(member => {
    const matchesSearch = 
      member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.mobile?.includes(searchTerm) ||
      member.aadharNo?.includes(searchTerm);
    
    const matchesGender = filterGender === 'all' || member.gender?.toLowerCase() === filterGender.toLowerCase();
    
    return matchesSearch && matchesGender;
  });

  // Statistics
  const totalMembers = members.length;
  const maleMembers = members.filter(m => m.gender?.toLowerCase() === 'male').length;
  const femaleMembers = members.filter(m => m.gender?.toLowerCase() === 'female').length;

  // Parse Firestore date string format
  const parseFirestoreDate = (dateValue) => {
    if (!dateValue) return null;
    
    try {
      // Check if it's a Firestore Timestamp object
      if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
      }
      // Check if it's already a Date object
      else if (dateValue instanceof Date) {
        return dateValue;
      }
      // Check if it's a string in Firestore format like "8 November 2025 at 16:00:10 UTC+5:30"
      else if (typeof dateValue === 'string') {
        if (dateValue.includes(' at ')) {
          const datePart = dateValue.split(' at ')[0];
          return new Date(datePart);
        } else {
          return new Date(dateValue);
        }
      }
      // If it's a number (timestamp in milliseconds)
      else if (typeof dateValue === 'number') {
        return new Date(dateValue);
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing date:', error, dateValue);
      return null;
    }
  };

  // Format date - handles Firestore Timestamps, Date objects, and string dates
  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    
    try {
      const date = parseFirestoreDate(dateValue);
      
      // Check if date is valid
      if (date && !isNaN(date.getTime())) {
        return date.toLocaleDateString('en-IN', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        });
      }
      
      // If all parsing fails, return the original value as string
      return String(dateValue);
    } catch (error) {
      console.error('Error formatting date:', error, dateValue);
      return 'Invalid Date';
    }
  };

  // Get registration status based on expiry date
  const getRegistrationStatus = (registration) => {
    if (!registration || !registration.expDate) return 'unknown';
    
    try {
      const expDate = parseFirestoreDate(registration.expDate);
      
      if (!expDate || isNaN(expDate.getTime())) {
        return 'unknown';
      }
      
      // Compare with today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day
      expDate.setHours(0, 0, 0, 0); // Reset time to start of day
      
      return expDate >= today ? 'active' : 'expired';
    } catch (error) {
      console.error('Error determining registration status:', error);
      return 'unknown';
    }
  };

  // Get subscription status based on end date
  const getSubscriptionStatus = (subscription) => {
    if (!subscription.endDate) return 'unknown';
    
    try {
      const endDate = parseFirestoreDate(subscription.endDate);
      
      if (!endDate || isNaN(endDate.getTime())) {
        return 'unknown';
      }
      
      // Compare with today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day
      endDate.setHours(0, 0, 0, 0); // Reset time to start of day
      
      return endDate >= today ? 'active' : 'expired';
    } catch (error) {
      console.error('Error determining subscription status:', error);
      return 'unknown';
    }
  };

  // Get facility name from facilityId (handles both string paths and Firestore references)
  const getFacilityName = (facilityId) => {
    if (!facilityId) return 'N/A';
    
    // Check if it's a Firestore reference object
    if (facilityId.path) {
      const parts = facilityId.path.split('/');
      return parts[parts.length - 1] || 'N/A';
    }
    
    // If it's already a string path
    if (typeof facilityId === 'string') {
      const parts = facilityId.split('/');
      return parts[parts.length - 1] || 'N/A';
    }
    
    return 'N/A';
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Members Management</h1>
        <p className="text-gray-600 mt-1">View and manage registered members</p>
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
          <h3 className="text-gray-600 text-sm font-medium">Total Members</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">{totalMembers}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-indigo-500">
          <h3 className="text-gray-600 text-sm font-medium">Active Members</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">N/A</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-pink-500">
          <h3 className="text-gray-600 text-sm font-medium">Registered Members</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">N/A</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by name, email, mobile or Aadhar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Gender</label>
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>
      </div>

      {/* Members List */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-gray-400 mb-4">
            <FiUser className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            {members.length === 0 ? 'No Members Yet' : 'No Results Found'}
          </h3>
          <p className="text-gray-600">
            {members.length === 0 
              ? 'No members have registered yet'
              : 'Try adjusting your search or filter criteria'
            }
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subscriptions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMembers.map((member) => {
                  const regStatus = getRegistrationStatus(member.registration);
                  return (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {member.name?.charAt(0)?.toUpperCase() || 'M'}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {member.name || 'N/A'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {member.fatherName || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <div className="flex items-center mb-1">
                            <FiMail className="w-3 h-3 mr-2 text-gray-400" />
                            <span className="truncate max-w-xs">{member.email || 'N/A'}</span>
                          </div>
                          <div className="flex items-center">
                            <FiPhone className="w-3 h-3 mr-2 text-gray-400" />
                            {member.mobile || 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {member.registration ? (
                            <div>
                              <div className="flex items-center mb-1">
                                {regStatus === 'active' ? (
                                  <FiCheckCircle className="w-4 h-4 mr-1 text-green-500" />
                                ) : (
                                  <FiXCircle className="w-4 h-4 mr-1 text-red-500" />
                                )}
                                <span className={`text-xs font-semibold ${
                                  regStatus === 'active' ? 'text-green-700' : 'text-red-700'
                                }`}>
                                  {regStatus === 'active' ? 'Active' : 'Expired'}
                                </span>
                              </div>
                              <div className="flex items-center text-xs text-gray-500">
                                <FiCalendar className="w-3 h-3 mr-1" />
                                {formatDate(member.registration.regDate)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">No registration</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {member.subscriptions && member.subscriptions.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {member.subscriptions.map((sub, idx) => {
                                const status = getSubscriptionStatus(sub);
                                return (
                                  <span
                                    key={idx}
                                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                      status === 'active'
                                        ? 'bg-green-100 text-green-800'
                                        : status === 'expired'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {getFacilityName(sub.facilityId)}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">No subscriptions</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewMember(member)}
                            className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded"
                            title="View Details"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(member.id, member.name)}
                            className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded"
                            title="Delete Member"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Results Count */}
      {filteredMembers.length > 0 && (
        <div className="mt-4 text-sm text-gray-600 text-center">
          Showing {filteredMembers.length} of {members.length} members
        </div>
      )}

      {/* Member Details Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-800">Member Details</h2>
              <button
                onClick={() => {
                  setSelectedMember(null);
                  setMemberDetails(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            {modalLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading details...</p>
              </div>
            ) : memberDetails ? (
              <div className="p-6">
                {/* Personal Information */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Full Name</label>
                      <p className="text-sm text-gray-900">{memberDetails.name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Father's Name</label>
                      <p className="text-sm text-gray-900">{memberDetails.fatherName || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Gender</label>
                      <p className="text-sm text-gray-900">{memberDetails.gender || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Date of Birth</label>
                      <p className="text-sm text-gray-900">{memberDetails.dob || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Aadhar Number</label>
                      <p className="text-sm text-gray-900 font-mono">{memberDetails.aadharNo || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Mobile</label>
                      <p className="text-sm text-gray-900">{memberDetails.mobile || 'N/A'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-gray-500">Email</label>
                      <p className="text-sm text-gray-900">{memberDetails.email || 'N/A'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-gray-500 flex items-center">
                        <FiMapPin className="w-3 h-3 mr-1" /> Address
                      </label>
                      <p className="text-sm text-gray-900">{memberDetails.address || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Registration Information */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Registration Status</h3>
                  {memberDetails.registration ? (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          {getRegistrationStatus(memberDetails.registration) === 'active' ? (
                            <FiCheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <FiXCircle className="w-5 h-5 text-red-500" />
                          )}
                          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                            getRegistrationStatus(memberDetails.registration) === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {getRegistrationStatus(memberDetails.registration) === 'active' ? 'Active Registration' : 'Expired Registration'}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Registration Date:</span>
                          <p className="text-gray-900 font-medium mt-1">
                            {formatDate(memberDetails.registration.regDate)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Expiry Date:</span>
                          <p className="text-gray-900 font-medium mt-1">
                            {formatDate(memberDetails.registration.expDate)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <p className="text-gray-500">No registration information available</p>
                    </div>
                  )}
                </div>

                {/* Active Subscriptions */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Subscriptions</h3>
                  {memberDetails.subscriptions && memberDetails.subscriptions.length > 0 ? (
                    <div className="space-y-3">
                      {memberDetails.subscriptions.map((sub, idx) => {
                        const status = getSubscriptionStatus(sub);
                        return (
                          <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold text-gray-900 capitalize">
                                    {getFacilityName(sub.facilityId)}
                                  </h4>
                                  <span
                                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                      status === 'active'
                                        ? 'bg-green-100 text-green-800'
                                        : status === 'expired'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {status}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-gray-500">Plan Type:</span>
                                    <span className="ml-2 text-gray-900 capitalize">{sub.planType || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Start Date:</span>
                                    <span className="ml-2 text-gray-900">{formatDate(sub.startDate)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">End Date:</span>
                                    <span className="ml-2 text-gray-900">{formatDate(sub.endDate)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Created:</span>
                                    <span className="ml-2 text-gray-900">{formatDate(sub.createdAt)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <p className="text-gray-500">No subscriptions</p>
                    </div>
                  )}
                </div>

                {/* Payment History */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Payment History</h3>
                  {memberDetails.paymentHistory && memberDetails.paymentHistory.length > 0 ? (
                    <div className="space-y-3">
                      {memberDetails.paymentHistory.map((payment, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <FiCreditCard className="w-5 h-5 text-gray-400 mt-1" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-semibold text-gray-900">₹{payment.amount || 0}</span>
                                  <span
                                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                      payment.status === 'Success'
                                        ? 'bg-green-100 text-green-800'
                                        : payment.status === 'Pending'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {payment.status || 'N/A'}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-gray-500">Method:</span>
                                    <span className="ml-2 text-gray-900">{payment.method || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Transaction ID:</span>
                                    <span className="ml-2 text-gray-900 font-mono text-xs">{payment.transactionId || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Facility:</span>
                                    <span className="ml-2 text-gray-900 capitalize">{getFacilityName(payment.facilityId)}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Date:</span>
                                    <span className="ml-2 text-gray-900">{formatDate(payment.paymentDate)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <FiCreditCard className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">No payment history</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}