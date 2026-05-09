import { Video, Mail } from 'lucide-react';
import { FaTwitter, FaGithub, FaLinkedin } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <Video className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">Meetzy</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Modern video calling and chat application for seamless collaboration.
            </p>
            <div className="flex gap-4">
              <a href="#" className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-colors">
                <FaTwitter className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-colors">
                <FaGithub className="w-5 h-5" />
              </a>
              <a href="#" className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-colors">
                <FaLinkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-6">Product</h4>
            <ul className="space-y-4 text-slate-600 dark:text-slate-400">
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Solutions</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Updates</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-6">Resources</h4>
            <ul className="space-y-4 text-slate-600 dark:text-slate-400">
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">API Reference</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Community</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Blog</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-6">Stay Connected</h4>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Subscribe to our newsletter for the latest updates.
            </p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Email address"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <button className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
                <Mail className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-10 flex flex-col md:row justify-between items-center gap-6">
          <p className="text-slate-500 dark:text-slate-500 text-sm">
            © 2026 Meetzy Inc. All rights reserved.
          </p>
          <div className="flex gap-8 text-sm text-slate-500 dark:text-slate-500">
            <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
