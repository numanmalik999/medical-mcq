"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, KeyRound, Loader2 } from 'lucide-react'; // Import KeyRound and Loader2
import { Link } from 'react-router-dom';

const UserProfilePage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isFetchingProfile, setIsFetchingProfile] = useState(true); // New combined loading state
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordResetting, setIsPasswordResetting] = useState(false); // New state for password reset

  const isGuestMode = !user; // Determine if in guest mode

  // Use VITE_PUBLIC_BASE_URL for production redirect, fallback to current origin for development
  const baseUrl = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;

  useEffect(() => {
    if (hasCheckedInitialSession) {
      if (user) {
        fetchProfile();
      } else {
        // If in guest mode, no profile to fetch, set default values
        setFirstName('');
        setLastName('');
        setAvatarUrl('');
        setPhoneNumber('');
        setWhatsappNumber('');
        setIsFetchingProfile(false); // Not logged in, stop loading
      }
    }
  }, [user, hasCheckedInitialSession]); // Dependencies changed

  const fetchProfile = async () => {
    if (!user) return; // Ensure user is available
    setIsFetchingProfile(true); // Set loading for this specific fetch
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error fetching profile:', error);
      toast({ title: "Error", description: "Failed to load profile.", variant: "destructive" });
    } else if (data) {
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setAvatarUrl(data.avatar_url || '');
      setPhoneNumber(data.phone_number || '');
      setWhatsappNumber(data.whatsapp_number || '');
    }
    setIsFetchingProfile(false); // Clear loading for this specific fetch
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);

    const updates = {
      id: user.id,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      phone_number: phoneNumber.trim() || null,
      whatsapp_number: whatsappNumber.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('profiles')
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      console.error('Error saving profile:', error);
      toast({ title: "Error", description: `Failed to save profile: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Profile updated successfully." });
      fetchProfile(); // Re-fetch to ensure state is consistent
    }
    setIsSaving(false);
  };

  const handleChangePassword = async () => {
    if (!user || !user.email) return;

    setIsPasswordResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${baseUrl}/login`, // Use the base URL for redirect
      });

      if (error) throw error;

      toast({
        title: "Password Reset Email Sent",
        description: "Please check your email inbox (and spam folder) for the password reset link.",
        variant: "default",
      });
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      toast({
        title: "Error",
        description: `Failed to send password reset email: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsPasswordResetting(false);
    }
  };

  if (!hasCheckedInitialSession || isFetchingProfile) { // Use hasCheckedInitialSession for initial loading
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-700">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Your Profile</h1>

      {isGuestMode && (
        <Card className="border-blue-500 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-700">Guest Mode Active</CardTitle>
            <CardDescription className="text-blue-600">
              You are currently browsing as a guest. Profile editing is disabled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-blue-800">
              <Link to="/user/subscriptions" className="font-semibold underline">Sign up and subscribe</Link> to create your personal profile and unlock all features.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Edit Profile Information</CardTitle>
          <CardDescription>Update your personal details and avatar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl || undefined} alt="User Avatar" />
              <AvatarFallback>
                <UserIcon className="h-12 w-12 text-gray-500" />
              </AvatarFallback>
            </Avatar>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="avatar-url">Avatar URL</Label>
              <Input
                id="avatar-url"
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="Enter URL for your avatar image"
                disabled={isGuestMode}
              />
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">First Name</Label>
                <Input
                  id="first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Your first name"
                  disabled={isGuestMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Last Name</Label>
                <Input
                  id="last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Your last name"
                  disabled={isGuestMode}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={user?.email || 'Guest'} disabled />
              <p className="text-sm text-muted-foreground">Email cannot be changed here.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone-number">Phone Number</Label>
                <Input
                  id="phone-number"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g., +1234567890"
                  disabled={isGuestMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp-number">WhatsApp Number</Label>
                <Input
                  id="whatsapp-number"
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="e.g., +1234567890"
                  disabled={isGuestMode}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={handleSaveProfile} disabled={isSaving || isGuestMode} className="sm:flex-1">
              {isSaving ? "Saving..." : "Save Profile"}
            </Button>
            <Button 
              onClick={handleChangePassword} 
              disabled={isPasswordResetting || isGuestMode || !user?.email} 
              variant="outline"
              className="sm:flex-1"
            >
              {isPasswordResetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending Link...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" /> Change Password
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <MadeWithDyad />
    </div>
  );
};

export default UserProfilePage;