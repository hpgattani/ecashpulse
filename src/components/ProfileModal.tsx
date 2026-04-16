import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User, Save, Camera, Loader2 } from 'lucide-react';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileModal = ({ open, onOpenChange }: ProfileModalProps) => {
  const { user, profile, sessionToken, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDisplayName(profile?.display_name || '');
      setBio(profile?.bio || '');
      setAvatarPreview(profile?.avatar_url || null);
    }
  }, [open, profile]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionToken) return;

    // Validate client-side
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Use JPEG, PNG, WebP, or GIF');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Max file size is 2MB');
      return;
    }

    // Show immediate preview
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/upload-avatar`,
        {
          method: 'POST',
          headers: {
            'x-session-token': sessionToken,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        toast.error(data.error || 'Failed to upload avatar');
        setAvatarPreview(profile?.avatar_url || null);
        return;
      }

      if (data.profile) {
        updateProfile(data.profile);
        setAvatarPreview(data.avatar_url);
        toast.success('Profile picture updated!');
      }
    } catch {
      toast.error('Failed to upload avatar');
      setAvatarPreview(profile?.avatar_url || null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!sessionToken) return;
    setUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-profile', {
        body: {
          session_token: sessionToken,
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          avatar_url: null
        }
      });
      if (error) throw error;
      if (data?.success && data?.profile) {
        updateProfile(data.profile);
        setAvatarPreview(null);
        toast.success('Profile picture removed!');
      }
    } catch {
      toast.error('Failed to remove profile picture');
    } finally {
      setUploading(false);
    }
  };

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
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-muted border-2 border-border">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity flex items-center justify-center"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Tap to change • Max 2MB</p>
              {avatarPreview && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={uploading}
                  className="text-xs text-destructive hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

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
