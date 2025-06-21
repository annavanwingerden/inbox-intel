"use client";

import { useEffect, useState } from 'react';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Session } from '@supabase/supabase-js';

interface Campaign {
  id: string;
  name: string;
  goal: string;
  audience: string;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const supabase = createSupabaseClient();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  // State for the form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignGoal, setNewCampaignGoal] = useState('');
  const [newCampaignAudience, setNewCampaignAudience] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Fetch Campaigns
      const { data: campaignData, error: campaignError } = await supabase.functions.invoke('campaign-manager', {
        method: 'GET',
      });
      if (campaignError) throw campaignError;
      if (campaignData.campaigns) setCampaigns(campaignData.campaigns);

      // Check for Gmail token
      const { data: tokenData, error: tokenError } = await supabase
        .from('user_tokens')
        .select('id')
        .single();
      
      if (tokenError && tokenError.code !== 'PGRST116') { // Ignore 'single row not found' error
        throw tokenError;
      }
      
      setIsGmailConnected(!!tokenData);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('campaign-manager', {
        method: 'POST',
        body: JSON.stringify({
          name: newCampaignName,
          goal: newCampaignGoal,
          audience: newCampaignAudience,
        }),
      });

      if (error) throw error;
      
      // Add the new campaign to the list and reset the form
      setCampaigns((prev) => [...prev, data.newCampaign]);
      setNewCampaignName('');
      setNewCampaignGoal('');
      setNewCampaignAudience('');
      setIsModalOpen(false);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('gmail-auth-start');
      
      if (error) {
        throw error;
      }
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Could not get authentication URL.");
      }
      
    } catch (err: any) {
      setError(`Error connecting to Gmail: ${err.message}`);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
    } else {
      setSession(null);
      setIsGmailConnected(false);
      setCampaigns([]);
      setError(null);
      setLoading(true);
      fetchData();
    }
  };

  return (
    <div className="container mx-auto p-8">
       {session && (
          <Button onClick={handleSignOut} variant="outline" className="absolute top-8 right-8">Sign Out</Button>
      )}
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : !isGmailConnected ? (
        <div className="flex items-center justify-center h-[80vh]">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Connect your Gmail Account</CardTitle>
                    <CardDescription>
                    To start sending campaigns, you need to connect your Gmail account.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleConnectGmail} className="w-full">
                    Connect Gmail
                    </Button>
                </CardContent>
            </Card>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Campaign Dashboard</h1>
            {session && (
              <>
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                  <DialogTrigger asChild>
                    <Button>Create New Campaign</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create a New Campaign</DialogTitle>
                      <DialogDescription>
                        Fill in the details for your new email campaign.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateCampaign} className="space-y-4">
                      <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="name">Campaign Name</Label>
                        <Input
                          type="text"
                          id="name"
                          placeholder="e.g., Q3 Product Launch"
                          value={newCampaignName}
                          onChange={(e) => setNewCampaignName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="audience">Audience (Coming Soon)</Label>
                        <Input
                          type="text"
                          id="audience"
                          placeholder="e.g., waitlist.csv"
                          value={newCampaignAudience}
                          onChange={(e) => setNewCampaignAudience(e.target.value)}
                          disabled // Disabled as per plan
                        />
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? "Creating..." : "Create Campaign"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>

          {!loading && !error && campaigns.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Replies</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>{campaign.name}</TableCell>
                    <TableCell>{campaign.status}</TableCell>
                    <TableCell>0</TableCell>
                    <TableCell>0</TableCell>
                    <TableCell>{new Date(campaign.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
} 