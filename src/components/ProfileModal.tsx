import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User, Save } from 'lucide-react';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileModal = ({ open, onOpenChange }: ProfileModalProps) => {
  const { user, profile, sessionToken, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [saving, setSaving] = useState(false);

  // Sync state when profile changes or modal opens
  useEffect(() => {
    if (open) {
      setDisplayName(profile?.display_name || '');
      setBio(profile?.bio || '');
    }
  }, [open, profile]);

  const handleSave = async () => {
    if (!user || !sessionToken) return;
    
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-profile', {
        body: { 
          session_token: sessionToken,
          display_name: displayName.trim() || null,
          bio: bio.trim() || null
        }
      });

      if (error) throw error;
      
      if (data?.success && data?.profile) {
        // Update context and localStorage via AuthContext
        updateProfile(data.profile);
        toast.success('Profile updated successfully!');
        onOpenChange(false);
      } else {
        throw new Error(data?.error || 'Failed to update profile');
      }
    } catch (err: any) {
      console.error('Error updating profile:', err);
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <User className="w-5 h-5" />
            Edit Profile
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="address" className="text-muted-foreground">eCash Address</Label>
            <Input
              id="address"
              value={user?.ecash_address || ''}
              disabled
              className="bg-muted text-muted-foreground font-mono text-sm"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="displayName">Username</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your username"
              maxLength={30}
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground">Max 30 characters</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              maxLength={200}
              rows={3}
              className="bg-background resize-none"
            />
            <p className="text-xs text-muted-foreground">{bio.length}/200 characters</p>
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !sessionToken}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
