"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Mail, Phone, MapPin } from 'lucide-react';

const ContactPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16 pb-12"> {/* Added pt-16 for fixed header */}
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center">Contact Us</CardTitle>
          <CardDescription className="text-center mt-2">
            We'd love to hear from you! Reach out with any questions or feedback.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-lg text-gray-700 dark:text-gray-300">
          <p>
            Whether you have a question about our features, pricing, need technical assistance, or just want to provide feedback, our team is ready to help.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Mail className="h-6 w-6 text-primary" />
              <p>Email: <a href="mailto:support@example.com" className="text-blue-600 hover:underline dark:text-blue-400">support@example.com</a></p>
            </div>
            <div className="flex items-center gap-4">
              <Phone className="h-6 w-6 text-primary" />
              <p>Phone: <a href="tel:+1234567890" className="text-blue-600 hover:underline dark:text-blue-400">+1 (234) 567-890</a></p>
            </div>
            <div className="flex items-center gap-4">
              <MapPin className="h-6 w-6 text-primary" />
              <p>Address: 123 Medical Prep Lane, Study City, ST 12345</p>
            </div>
          </div>
          <p>
            We strive to respond to all inquiries within 24-48 business hours.
          </p>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default ContactPage;