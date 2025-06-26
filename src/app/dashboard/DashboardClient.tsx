'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/utils/supabase';
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
import Link from 'next/link';

interface Campaign {
  id: string;
  name: string;
  goal: string;
  audience: string;
  created_at: string;
}

export default function DashboardClient() {
  const supabase = createBrowserClient();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // State for the form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignGoal, setNewCampaignGoal] = useState('');
  const [newCampaignAudience, setNewCampaignAudience] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔍 Auth state change:', event, session?.user?.email);
        
        if (event === 'SIGNED_IN' && session) {
          setUser(session.user);
          await fetchDashboardData();
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          router.push('/login');
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setUser(session.user);
        }
      }
    );

    // Initial session check
    const checkInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('🔍 Initial session check:', session?.user?.email);
        
        if (session) {
          setUser(session.user);
          await fetchDashboardData();
        } else {
          console.log('❌ No session found, redirecting to login');
          router.push('/login');
        }
      } catch (err: any) {
        console.error('💥 Session check error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkInitialSession();

    // Cleanup subscription
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const fetchDashboardData = async () => {
    try {
      console.log('🔍 Fetching dashboard data...');
      
      // Now fetch campaigns and Gmail status
      const [campaignResponse, tokenResponse] = await Promise.all([
        supabase.functions.invoke('campaign-manager', { method: 'GET' }),
        supabase.from('user_tokens').select('id').single(),
      ]);

      const { data: campaignData, error: campaignError } = campaignResponse;
      const { data: tokenData, error: tokenError } = tokenResponse;

      if (campaignError) {
        console.error('Error fetching campaigns:', campaignError);
      }
      
      if (tokenError && tokenError.code !== 'PGRST116') {
        console.error('Error fetching gmail token:', tokenError);
      }

      setCampaigns(campaignData?.campaigns || []);
      setIsGmailConnected(!!tokenData);
      console.log('✅ Dashboard data loaded');

    } catch (err: any) {
      console.error('💥 Dashboard data error:', err);
      setError(err.message);
    }
  };

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
      router.push('/login');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!user) {
    return <div>Not authenticated</div>;
  }

  if (!isGmailConnected) {
    return (
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
    )
  }

  return (
    <>
      <Button onClick={handleSignOut} variant="outline" className="absolute top-8 right-8">Sign Out</Button>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Campaign Dashboard</h1>
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
                <Label htmlFor="goal">Campaign Goal</Label>
                <Input
                  type="text"
                  id="goal"
                  placeholder="e.g., Generate 50 qualified leads"
                  value={newCampaignGoal}
                  onChange={(e) => setNewCampaignGoal(e.target.value)}
                  required
                />
              </div>
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="audience">Target Audience</Label>
                <Input
                  type="text"
                  id="audience"
                  placeholder="e.g., SaaS founders, Marketing managers"
                  value={newCampaignAudience}
                  onChange={(e) => setNewCampaignAudience(e.target.value)}
                  required
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
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campaign Name</TableHead>
            <TableHead>Goal</TableHead>
            <TableHead>Audience</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell>
                <Link 
                  href={`/campaigns/${campaign.id}`}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  {campaign.name}
                </Link>
              </TableCell>
              <TableCell className="max-w-xs truncate">{campaign.goal}</TableCell>
              <TableCell className="max-w-xs truncate">{campaign.audience}</TableCell>
              <TableCell>{new Date(campaign.created_at).toLocaleDateString()}</TableCell>
              <TableCell>
                <Link href={`/campaigns/${campaign.id}`}>
                  <Button variant="outline" size="sm">
                    View & Compose
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
