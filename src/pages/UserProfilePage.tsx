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
import { User as UserIcon } from 'lucide-react';
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

  const isGuestMode = !user; // Determine if in guest mode

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

  if (!hasCheckedInitialSession || isFetchingProfile) { // Use hasCheckedInitialSession for initial loading
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Your Profile</h1>

      {isGuestMode && (
        <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950">
          <CardHeader>
            <CardTitle className="text-blue-700 dark:text-blue-300">Guest Mode Active</CardTitle>
            <CardDescription className="text-blue-600 dark:text-blue-400">
              You are currently browsing as a guest. Profile editing is disabled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-blue-800 dark:text-blue-200">
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
          <Button onClick={handleSaveProfile} disabled={isSaving || isGuestMode}>
            {isSaving ? "Saving..." : "Save Profile"}
          </Button>
        </CardContent>
      </Card>

      <MadeWithDyad />
    </div>
  );
};

export default UserProfilePage;