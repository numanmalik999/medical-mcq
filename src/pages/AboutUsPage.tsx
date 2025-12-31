"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from "react-router-dom";
import { Heart, ShieldCheck, Zap, Award, Users, BookOpen } from "lucide-react";
import { cn } from '@/lib/utils';

const AboutUsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 bg-primary text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/3 translate-y-1/3 blur-3xl"></div>
        </div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <Badge className="mb-4 bg-white/20 hover:bg-white/30 text-white border-none px-4 py-1">Empowering Healthcare Professionals</Badge>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">Your Partner in Medical <br/>Licensing Excellence</h1>
          <p className="text-xl max-w-2xl mx-auto opacity-90 leading-relaxed">
            We bridge the gap between medical knowledge and exam success with AI-powered tools and expert-curated content.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Our Mission</h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
              At Study Prometric, our mission is to simplify the complex journey of medical licensing. We believe that every healthcare professional deserves access to high-quality, relevant, and engaging study materials that reflect the reality of modern medical practice.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {[
                 { icon: <ShieldCheck className="text-green-500" />, text: "Verified Clinical Accuracy" },
                 { icon: <Zap className="text-yellow-500" />, text: "AI-Driven Insights" },
                 { icon: <Heart className="text-red-500" />, text: "Student-First Support" },
                 { icon: <Award className="text-blue-500" />, text: "Exam-Aligned Content" }
               ].map((item, i) => (
                 <div key={i} className="flex items-center gap-2 font-medium">
                   {item.icon}
                   <span>{item.text}</span>
                 </div>
               ))}
            </div>
          </div>
          <div className="relative">
            <div className="aspect-video bg-muted rounded-2xl overflow-hidden shadow-2xl border">
                <img 
                    src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=1000" 
                    alt="Medical Professionals" 
                    className="w-full h-full object-cover"
                />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-muted/50 py-16 border-y">
        <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-4xl font-bold text-primary">10k+</p>
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Active Students</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-primary">5,000+</p>
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Updated MCQs</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-primary">95%</p>
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Success Rate</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-primary">24/7</p>
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">AI Assistance</p>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">The Study Prometric Advantage</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="hover:shadow-lg transition-all border-t-4 border-t-primary">
            <CardContent className="pt-6">
              <div className="mb-4 bg-primary/10 w-12 h-12 flex items-center justify-center rounded-lg">
                <Users className="text-primary h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">Expert Community</h3>
              <p className="text-muted-foreground">Join a network of thousands of peers sharing tips and strategies for the Gulf exams.</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-all border-t-4 border-t-primary">
            <CardContent className="pt-6">
              <div className="mb-4 bg-primary/10 w-12 h-12 flex items-center justify-center rounded-lg">
                <BookOpen className="text-primary h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">Simulated Testing</h3>
              <p className="text-muted-foreground">Our testing engine replicates the actual Prometric interface to build your confidence.</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-all border-t-4 border-t-primary">
            <CardContent className="pt-6">
              <div className="mb-4 bg-primary/10 w-12 h-12 flex items-center justify-center rounded-lg">
                <Award className="text-primary h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">Gamified Learning</h3>
              <p className="text-muted-foreground">Win free subscriptions and track your leaderboard rank while you master the material.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 container mx-auto px-4 text-center">
        <div className="bg-gray-900 text-white rounded-3xl p-12 shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Start Your Success Story Today</h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">Take the first step towards practicing in the Gulf with the most advanced preparation platform.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <Button size="lg" className="w-full sm:w-auto px-8 py-6 text-lg">Join for Free Trial</Button>
              </Link>
              <Link to="/subscription">
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 py-6 text-lg text-white border-white hover:bg-white hover:text-gray-900">Explore Plans</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="pb-12">
        <MadeWithDyad />
      </div>
    </div>
  );
};

// Internal Badge helper for About Page
const Badge = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)}>
        {children}
    </span>
);

export default AboutUsPage;