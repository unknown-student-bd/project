import React, { useState } from 'react';
import { Heart, User } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface DonatorFormProps {
  onAdd: (name: string) => Promise<boolean>;
}

const DonatorForm: React.FC<DonatorFormProps> = ({ onAdd }) => {
  const { isDarkMode } = useTheme();
  const [donatorName, setDonatorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donatorName.trim()) return;

    setIsSubmitting(true);
    const success = await onAdd(donatorName);
    
    if (success) {
      setDonatorName('');
      alert('Thank you! Your name has been added to our supporters list.');
    } else {
      alert('Failed to add your name. Please try again.');
    }
    
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-2">
      <div className="relative flex-1">
        <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
        <input
          type="text"
          value={donatorName}
          onChange={(e) => setDonatorName(e.target.value)}
          className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm ${
            isDarkMode 
              ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-800 placeholder-gray-500'
          }`}
          placeholder="Enter your name"
          required
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting || !donatorName.trim()}
        className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
      >
        <Heart className="w-4 h-4" />
        <span>{isSubmitting ? 'Adding...' : 'Add Me'}</span>
      </button>
    </form>
  );
};

export default DonatorForm;