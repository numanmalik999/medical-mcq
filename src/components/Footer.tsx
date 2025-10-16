"use client";

import { Link } from 'react-router-dom';
import { MadeWithDyad } from './made-with-dyad';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card text-card-foreground py-8 border-t border-border mt-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          {/* Company Info */}
          <div className="space-y-2">
            <h4 className="text-lg font-semibold">Study Prometric MCQs</h4>
            <p className="text-sm text-muted-foreground">
              Your partner in medical education excellence.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <h4 className="text-lg font-semibold">Quick Links</h4>
            <nav className="flex flex-col space-y-1 text-sm">
              <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">About Us</Link>
              <Link to="/faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
              <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            </nav>
          </div>

          {/* Legal */}
          <div className="space-y-2">
            <h4 className="text-lg font-semibold">Legal</h4>
            <nav className="flex flex-col space-y-1 text-sm">
              <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
            </nav>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center text-sm text-muted-foreground">
          <p>&copy; {currentYear} Study Prometric MCQs. All rights reserved.</p>
          <MadeWithDyad />
        </div>
      </div>
    </footer>
  );
};

export default Footer;