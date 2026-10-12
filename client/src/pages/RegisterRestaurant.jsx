import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, ExternalLink, Sparkles } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function RegisterRestaurant() {
  const [searchParams] = useSearchParams();
  const urlPlan = (searchParams.get('plan') || 'GROWTH').toUpperCase();
  const urlCycle = searchParams.get('cycle') || 'monthly';
  const defaultPlan = ['STARTER', 'GROWTH', 'BUSINESS', 'PRO'].includes(urlPlan) ? urlPlan : 'GROWTH';

  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    type: 'Restaurant',
    phone: '',
    
    ownerName: '',
    ownerPhone: '',
    
    selectedPlan: defaultPlan,
    billingCycle: urlCycle === 'yearly' ? 'yearly' : 'monthly'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const payload = {
      name: formData.name,
      subdomain: formData.subdomain,
      type: 'Restaurant',
      phone: formData.ownerPhone,
      ownerName: formData.ownerName,
      ownerPhone: formData.ownerPhone,
      selectedPlan: formData.selectedPlan,
      billingCycle: formData.billingCycle
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (success) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border border-gray-100">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Submitted!</h2>
            <p className="text-gray-600 mb-6">
              Your restaurant registration has been submitted successfully. Our team will review your application.
            </p>
            <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg mb-8 font-medium border border-yellow-200">
              Status: Pending Approval
            </div>
            <p className="text-sm text-gray-500 mb-8">
              You will receive a WhatsApp notification with your login details once your restaurant is approved.
            </p>
            <Link to="/" className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-colors">
              Return to Home
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-[#eafaf0] via-[#f7fdf9] to-white flex flex-col pt-32 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto w-full mb-8">
          <Link to="/" className="inline-flex items-center text-green-600 hover:text-green-700 font-medium">
            <ArrowLeft size={16} className="mr-2" /> Back to Home
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Register Your Restaurant
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Fill out the details below to start receiving orders digitally.
          </p>
        </div>

      <div className="max-w-2xl mx-auto w-full">
        <form className="space-y-8" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <div className="bg-white py-8 px-8 shadow-xl shadow-gray-200/40 sm:rounded-2xl border border-gray-100 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Restaurant Name <span className="text-red-500">*</span></label>
                  <input name="name" type="text"  required value={formData.name} placeholder="Restaurant Name..." onChange={handleChange} className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all outline-none text-gray-900 bg-gray-50 hover:bg-white" />
                </div>
  
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Desired Domain <span className="text-red-500">*</span></label>
                  <div 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:border-transparent transition-all bg-gray-50 hover:bg-white flex items-center cursor-text overflow-hidden"
                    onClick={() => document.getElementById('subdomain-input')?.focus()}
                  >
                    <div className="relative flex items-center min-w-[10px]">
                      <span className="invisible whitespace-pre font-sans text-base">{formData.subdomain || 'myrestaurant'}</span>
                      <input 
                        id="subdomain-input"
                        name="subdomain" 
                        type="text" 
                        required 
                        placeholder="myrestaurant"
                        value={formData.subdomain} 
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                          handleChange({ target: { name: 'subdomain', value: val } });
                        }} 
                        className="absolute inset-0 outline-none bg-transparent text-gray-900 p-0 border-none focus:ring-0 w-full font-sans text-base" 
                      />
                    </div>
                    <span className="text-gray-700 font-medium select-none ml-0.5">.dynease.in</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Owner Full Name <span className="text-red-500">*</span></label>
                  <input name="ownerName" type="text" required placeholder="Owner Name...." value={formData.ownerName} onChange={handleChange} className="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all outline-none text-gray-900 bg-gray-50 hover:bg-white" />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Owner Mobile <span className="text-red-500">*</span></label>
                  <div className="flex shadow-sm rounded-xl overflow-hidden border border-gray-200 focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:border-transparent transition-all bg-gray-50 hover:bg-white">
                    <span className="inline-flex items-center px-4 bg-gray-100/50 border-r border-gray-200 text-gray-500 font-bold">
                      +91
                    </span>
                    <input 
                      name="ownerPhone" 
                      type="tel" 
                      required 
                      maxLength="10"
                      minLength="10"
                      pattern="[0-9]{10}"
                      title="Please enter a valid 10-digit mobile number"
                      placeholder="9876543210"
                      value={formData.ownerPhone} 
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, ''); // Allow only digits
                        handleChange({ target: { name: 'ownerPhone', value: val } });
                      }} 
                      className="flex-1 w-full px-4 py-3 border-none outline-none text-gray-900 bg-transparent focus:ring-0" 
                    />
                  </div>
                </div>
              </div>
          </div>

          {/* SECTION 3: Plan Selection */}
          <div className="bg-white py-8 px-8 shadow-xl shadow-gray-200/40 sm:rounded-2xl border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b pb-4 mb-6 gap-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Choose Your Subscription Plan</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="inline-flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, billingCycle: 'monthly' })}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      formData.billingCycle === 'monthly' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, billingCycle: 'yearly' })}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      formData.billingCycle === 'yearly' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-500'
                    }`}
                  >
                    Yearly (Save 16.7%)
                  </button>
                </div>
                <Link to="/pricing" target="_blank" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                  View all details <ExternalLink size={12} />
                </Link>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Starter Plan */}
              <label className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border-2 transition-all ${
                formData.selectedPlan === 'STARTER' ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500' : 'border-gray-200 hover:border-emerald-200'
              }`}>
                <input type="radio" name="selectedPlan" value="STARTER" checked={formData.selectedPlan === 'STARTER'} onChange={handleChange} className="sr-only" />
                <span className="text-base font-bold text-gray-900">Starter</span>
                <span className="text-lg font-extrabold text-gray-900 mt-1">
                  {formData.billingCycle === 'yearly' ? '₹9,990/yr' : '₹999/mo'}
                </span>
                <span className="text-[11px] text-gray-500 mt-2">10 Tables • 50 Items • 3 Staff</span>
              </label>

              {/* Growth Plan */}
              <label className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border-2 transition-all ${
                formData.selectedPlan === 'GROWTH' ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500' : 'border-gray-200 hover:border-emerald-200'
              }`}>
                <input type="radio" name="selectedPlan" value="GROWTH" checked={formData.selectedPlan === 'GROWTH'} onChange={handleChange} className="sr-only" />
                <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider py-0.5 px-2.5 rounded-full">
                  Popular
                </div>
                <span className="text-base font-bold text-gray-900 mt-1">Growth</span>
                <span className="text-lg font-extrabold text-emerald-700 mt-1">
                  {formData.billingCycle === 'yearly' ? '₹19,990/yr' : '₹1,999/mo'}
                </span>
                <span className="text-[11px] text-gray-600 mt-2">30 Tables • 200 Items • Reports</span>
              </label>

              {/* Business Plan */}
              <label className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border-2 transition-all ${
                formData.selectedPlan === 'BUSINESS' ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-200'
              }`}>
                <input type="radio" name="selectedPlan" value="BUSINESS" checked={formData.selectedPlan === 'BUSINESS'} onChange={handleChange} className="sr-only" />
                <span className="text-base font-bold text-gray-900">Business</span>
                <span className="text-lg font-extrabold text-indigo-700 mt-1">
                  {formData.billingCycle === 'yearly' ? '₹34,990/yr' : '₹3,499/mo'}
                </span>
                <span className="text-[11px] text-gray-600 mt-2">3 Locations • Unlimited Tables</span>
              </label>

              {/* Pro Plan */}
              <label className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border-2 transition-all ${
                formData.selectedPlan === 'PRO' ? 'border-amber-500 bg-amber-50/40 ring-1 ring-amber-500' : 'border-gray-200 hover:border-amber-200'
              }`}>
                <input type="radio" name="selectedPlan" value="PRO" checked={formData.selectedPlan === 'PRO'} onChange={handleChange} className="sr-only" />
                <span className="text-base font-bold text-gray-900">Pro</span>
                <span className="text-lg font-extrabold text-amber-700 mt-1">
                  {formData.billingCycle === 'yearly' ? '₹59,990/yr' : '₹5,999/mo'}
                </span>
                <span className="text-[11px] text-gray-600 mt-2">5 Locations • Full CRM & Loyalty</span>
              </label>
            </div>
          </div>

          <div>
            <button type="submit" disabled={loading} className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-lg font-bold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-colors">
              {loading ? 'Submitting Registration...' : 'Submit Registration'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </>
  );
}
