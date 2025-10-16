"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';

const AboutUsPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16 pb-12"> {/* Added pt-16 for fixed header */}
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center">About Study Prometric MCQs</CardTitle>
          <CardDescription className="text-center mt-2">
            Your dedicated partner in medical education.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-lg text-gray-700 dark:text-gray-300">
          <p>
            At Study Prometric MCQs, we are passionate about empowering medical students and professionals to achieve their academic and career goals. We understand the challenges of preparing for rigorous medical exams, and our platform is designed to simplify and enhance your study process.
          </p>
          <p>
            Our mission is to provide a comprehensive, interactive, and intelligent learning environment. We leverage cutting-edge technology, including AI-powered explanations, to offer a personalized and effective study experience. Our extensive question bank, curated by experts, ensures you have access to high-quality, relevant content.
          </p>
          <p>
            We believe in continuous improvement and community contribution. That's why we enable users to submit their own MCQs and provide feedback, helping us grow and refine our resources for everyone. Join us on your journey to medical excellence!
          </p>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default AboutUsPage;