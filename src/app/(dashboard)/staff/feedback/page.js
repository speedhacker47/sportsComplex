// src/app/(main)/feedback/page.js
'use client';

import { useState } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FiUpload, FiX, FiAlertCircle, FiCheckCircle, FiImage, FiSend, FiHeart } from 'react-icons/fi';
import Image from 'next/image';

const FeedbackPage = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'bug'
  });
  
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });

  const categories = [
    { value: 'bug', label: 'Bug Report', icon: '🐛' },
    { value: 'feature', label: 'Feature Request', icon: '✨' },
    { value: 'improvement', label: 'Improvement', icon: '🚀' },
    { value: 'other', label: 'Other', icon: '💬' }
  ];

  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setToast({ message: 'Please upload an image file', type: 'error' });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setToast({ message: 'Image size should be less than 5MB', type: 'error' });
        return;
      }

      setScreenshot(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.title.trim()) {
      setToast({ message: 'Please enter a title', type: 'error' });
      return;
    }

    if (!formData.description.trim()) {
      setToast({ message: 'Please enter a description', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      let screenshotUrl = null;

      // Upload screenshot if provided
      if (screenshot) {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${screenshot.name}`;
        const storageRef = ref(storage, `feedbacks/${fileName}`);
        
        await uploadBytes(storageRef, screenshot);
        screenshotUrl = await getDownloadURL(storageRef);
      }

      // Save feedback to Firestore
      await addDoc(collection(db, 'feedbacks'), {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        screenshotUrl: screenshotUrl,
        status: 'pending',
        createdAt: serverTimestamp(),
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`
      });

      setToast({ message: 'Feedback submitted successfully!', type: 'success' });
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        category: 'bug',
      });
      setScreenshot(null);
      setScreenshotPreview(null);

    } catch (error) {
      console.error('Error submitting feedback:', error);
      setToast({ message: 'Failed to submit feedback. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-0">
      <div className="max-w-4xl mx-auto">
        
        {/* Toast Notification */}
        {toast.message && (
          <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {toast.type === 'success' ? <FiCheckCircle className="w-5 h-5" /> : <FiAlertCircle className="w-5 h-5" />}
            <span>{toast.message}</span>
            <button onClick={() => setToast({ message: '', type: '' })} className="ml-2">
              <FiX className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Feedback & Report Issue</h1>
          <p className="text-gray-600">Help us improve by sharing your feedback or reporting any issues you encounter</p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xl">🐛</span>
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">Report Bugs</h3>
                <p className="text-xs text-blue-700">Found an issue? Let us know</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-xl">✨</span>
              </div>
              <div>
                <h3 className="font-semibold text-purple-900">Request Features</h3>
                <p className="text-xs text-purple-700">Share your ideas with us</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-xl">💬</span>
              </div>
              <div>
                <h3 className="font-semibold text-green-900">Give Feedback</h3>
                <p className="text-xs text-green-700">Tell us what you think</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.category === cat.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">{cat.icon}</div>
                      <div className="text-sm font-medium text-gray-900">{cat.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              
              {/* Title Input */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Brief summary of your feedback or issue"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">{formData.title.length}/100 characters</p>
              </div>

              {/* Description Textarea */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Provide detailed information about your feedback or the issue you're experiencing..."
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                  maxLength={1000}
                />
                <p className="text-xs text-gray-500 mt-1">{formData.description.length}/1000 characters</p>
              </div>

              {/* Screenshot Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Screenshot (Optional)
                </label>
                
                {!screenshotPreview ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                    <input
                      type="file"
                      id="screenshot"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label htmlFor="screenshot" className="cursor-pointer">
                      <FiUpload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Click to upload screenshot
                      </p>
                      <p className="text-xs text-gray-500">
                        PNG, JPG, GIF up to 5MB
                      </p>
                    </label>
                  </div>
                ) : (
                  <div className="relative border border-gray-300 rounded-lg p-4">
                    <button
                      type="button"
                      onClick={removeScreenshot}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors z-10"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                    <img
                      src={screenshotPreview}
                      alt="Screenshot preview"
                      className="w-full h-auto rounded-lg"
                    />
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                      <FiImage className="w-4 h-4" />
                      <span>{screenshot.name}</span>
                      <span className="text-gray-400">({(screenshot.size / 1024).toFixed(2)} KB)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  <span className="text-red-500">*</span> Required fields
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FiSend className="w-5 h-5" />
                      Submit Feedback
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Company Footer */}
        <div className="relative bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-t-3xl overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          </div>
          
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-10 left-10 w-20 h-20 border-4 border-white rounded-full animate-pulse"></div>
            <div className="absolute top-20 right-20 w-16 h-16 border-4 border-white rounded-lg rotate-45 animate-pulse delay-100"></div>
            <div className="absolute bottom-20 left-1/4 w-12 h-12 border-4 border-white rounded-full animate-pulse delay-200"></div>
          </div>

          <div className="relative z-10 py-12 px-6 text-center">
            {/* Decorative Top Line */}
            <div className="flex items-center justify-center mb-6">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-white/50"></div>
              <div className="mx-4 text-white/60">✦</div>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-white/50"></div>
            </div>

            {/* Company Name */}
            <div className="mb-4">
              <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-white">
                  Curiosity Lab
                </span>
              </h2>
              <div className="mt-2 flex items-center justify-center gap-2">
                <div className="h-1 w-8 bg-white/40 rounded-full"></div>
                <div className="h-1 w-12 bg-white/60 rounded-full"></div>
                <div className="h-1 w-8 bg-white/40 rounded-full"></div>
              </div>
            </div>

            {/* Tagline */}
            <p className="text-white/90 text-lg font-light mb-6 tracking-wide">
              Innovating Tomorrow, Today
            </p>

            {/* Made with Love */}
            <div className="flex items-center justify-center gap-2 text-white/80 text-sm">
              <span className="font-light">Crafted with</span>
              <FiHeart className="w-4 h-4 text-red-300 fill-red-300 animate-pulse" />
              <span className="font-light">by our team</span>
            </div>

            {/* Decorative Bottom Line */}
            <div className="flex items-center justify-center mt-6">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-white/50"></div>
              <div className="mx-4 text-white/60">✦</div>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-white/50"></div>
            </div>

            {/* Copyright */}
            <p className="text-white/60 text-xs mt-6 font-light">
              © {new Date().getFullYear()} Curiosity Lab. All rights reserved.
            </p>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default FeedbackPage;