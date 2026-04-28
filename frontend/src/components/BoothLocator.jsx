import React from 'react';

/**
 * BoothLocator.jsx
 * 
 * Demonstrates integration with Google Maps Platform API.
 * This component provides voters with directions to their designated polling booth.
 */
export default function BoothLocator() {
  return (
    <section className="mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700 p-6">
      <header className="mb-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          📍 Find Your Polling Booth
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Powered by Google Maps Platform. Enter your voter ID or address to locate your nearest polling station.
        </p>
      </header>
      
      {/* Mock Search Input */}
      <div className="flex gap-2 mb-4">
        <input 
          type="text" 
          placeholder="Enter Voter ID (EPIC No.) or Address..." 
          className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          defaultValue="Shivaji Nagar, Pune"
        />
        <button className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors">
          Search
        </button>
      </div>

      {/* Google Maps iFrame Placeholder (Integration Demo) */}
      <div className="w-full h-64 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
        <iframe 
          width="100%" 
          height="100%" 
          style={{ border: 0 }}
          loading="lazy" 
          allowFullScreen 
          referrerPolicy="no-referrer-when-downgrade" 
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d121059.04360431872!2d73.7929269553767!3d18.524603553428926!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2bf2e67461101%3A0x828d43bf9d9ee343!2sPune%2C%20Maharashtra!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
          title="Google Maps Polling Booth Locator"
        ></iframe>
      </div>
      
      <div className="mt-3 flex justify-between items-center text-xs text-gray-500">
        <span>Distance: 1.2 km away</span>
        <a href="#" className="text-orange-600 hover:underline font-semibold">Get Directions ↗</a>
      </div>
    </section>
  );
}
