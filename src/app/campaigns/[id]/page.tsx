'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Reply {
  id: string;
  snippet: string;
  from_address: string;
  body: string;
}

interface Email {
  id: string;
  recipient_email: string;
  subject: string;
  status: 'sent' | 'replied';
  sent_at: string;
  original_draft: any; // Can be string or object
  replies: Reply[];
  thread_id?: string; // Add this line
  message_id?: string;
}

interface Campaign {
  id: string;
  name: string;
  goal: string;
  audience: string;
  created_at: string;
  emails: Email[];
}

interface GeneratedEmail {
  subject: string;
  body: string;
}

interface Lead {
  id: string;
  campaign_id: string;
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const triggerConfetti = () => {
  const duration = 3 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
  }, 250);
};

export default function CampaignDetail() {
  const params = useParams();
  const campaignId = params.id as string;
  const supabase = createSupabaseClient();
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Email composer state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Leads management state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);

  // Reply modal state
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [notes, setNotes] = useState('');
  const [outcomeTag, setOutcomeTag] = useState('');
  const [isSavingTag, setIsSavingTag] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);


  useEffect(() => {
    fetchCampaign();
  }, [campaignId]);

  const fetchCampaign = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Fetch campaign details
      const { data: campaignData, error: campaignError } = await supabase.functions.invoke('campaign-manager', {
        method: 'GET',
      });

      if (campaignError) throw campaignError;
      
      const campaign = campaignData.campaigns?.find((c: Campaign) => c.id === campaignId);
      if (!campaign) {
        throw new Error("Campaign not found");
      }
      
      setCampaign(campaign);

      // Fetch leads for this campaign
      await fetchLeads();

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      setIsLoadingLeads(true);
      const { data, error } = await supabase.functions.invoke('leads-manager', {
        method: 'GET',
        query: { campaign_id: campaignId }
      });

      if (error) throw error;
      
      if (data.leads) {
        setLeads(data.leads);
      }

    } catch (err: any) {
      console.error('Error fetching leads:', err.message);
      // Don't set main error state for leads loading failure
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const handleGenerateEmail = async () => {
    if (!campaign) return;

    try {
      setIsGenerating(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('generate-email-draft', {
        body: JSON.stringify({
          campaignGoal: campaign.goal,
          audience: campaign.audience,
          campaignId: campaign.id
        }),
      });

      if (error) throw error;

      if (data.success && data.email) {
        const generatedEmail: GeneratedEmail = data.email;
        setSubject(generatedEmail.subject);
        setBody(generatedEmail.body);
        toast.success("Email generated successfully!");
      } else {
        throw new Error("Failed to generate email");
      }

    } catch (err: any) {
      setError(err.message);
      toast.error("Failed to generate email: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!campaign || !recipientEmail.trim() || !subject.trim() || !body.trim()) {
      toast.error("Please fill in all fields: recipient email, subject, and body");
      return;
    }

    try {
      setIsSending(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: JSON.stringify({
          recipientEmail: recipientEmail.trim(),
          subject: subject.trim(),
          body: body.trim(),
          campaignId: campaign.id
        }),
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Email sent successfully!");
        triggerConfetti();
        // Clear the form
        setRecipientEmail('');
        setSubject('');
        setBody('');
      } else {
        throw new Error("Failed to send email");
      }

    } catch (err: any) {
      setError(err.message);
      toast.error("Failed to send email: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateFollowUp = async () => {
    if (!campaign || !selectedEmail) return;

    // Ensure there is a reply to create context from
    if (!selectedEmail.replies || selectedEmail.replies.length === 0) {
      toast.error("Cannot generate follow-up for an email with no replies.");
      return;
    }
    
    // Find the original draft from the 'emails' array in the campaign state
    const originalEmail = campaign.emails.find(e => e.id === selectedEmail.id);
    if (!originalEmail || !originalEmail.original_draft) {
        toast.error("Could not find the original email draft to generate context.");
        return;
    }

    try {
      setIsGeneratingFollowUp(true);
      setFollowUpDraft('');

      const thread_context = `
        Original Email Sent by You:
        Subject: ${originalEmail.original_draft.subject}
        Body:
        ${originalEmail.original_draft.body}

        ---

        Reply from ${selectedEmail.replies[0]?.from_address}:
        ${selectedEmail.replies[0]?.body}
      `;

      const { data, error } = await supabase.functions.invoke('generate-email-draft', {
        body: JSON.stringify({
          campaignGoal: campaign.goal,
          audience: campaign.audience,
          thread_context,
          user_notes: notes,
        }),
      });

      if (error) throw error;

      if (data.success && data.email) {
        const generatedEmail: GeneratedEmail = data.email;
        setFollowUpDraft(`Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`);
        toast.success("Follow-up draft generated!");
      } else {
        throw new Error(data.error || "Failed to generate follow-up draft");
      }

    } catch (err: any) {
      console.error("Error generating follow-up:", err);
      toast.error(`Failed to generate follow-up: ${err.message}`);
    } finally {
      setIsGeneratingFollowUp(false);
    }
  };

  const handleSendFollowUp = async () => {
    if (!selectedEmail || !followUpDraft || !campaign) {
      toast.error("No follow-up draft to send.");
      return;
    }

    // This is a temporary measure. We assume the `from_address` in the first reply
    // is who we are replying to. In a real scenario, you might need more robust logic.
    const recipient = selectedEmail.replies[0]?.from_address;
    if (!recipient) {
      toast.error("Could not determine the recipient for the follow-up.");
      return;
    }
    
    // This is also temporary. We need the user's own email address.
    // We'll have to fetch this properly later. For now, we assume it's available.
    // Let's get it from the session or user profile.
    const { data: { user } } = await supabase.auth.getUser();
    const fromAddress = user?.email;
    if (!fromAddress) {
       toast.error("Could not determine your email address to send from.");
       return;
    }


    // Parse subject and body from the draft
    const lines = followUpDraft.split('\n');
    const subjectLine = lines.find(line => line.toLowerCase().startsWith('subject:'));
    const subject = subjectLine ? subjectLine.substring(8).trim() : 'Re: ' + selectedEmail.subject;
    const body = lines.slice(lines.findIndex(line => line.trim() === '') + 1).join('\n');

    try {
      setIsSendingFollowUp(true);

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: JSON.stringify({
          recipientEmail: recipient,
          subject,
          body,
          campaignId: campaign.id,
          threadId: selectedEmail.thread_id,
          inReplyTo: selectedEmail.message_id, // Assuming the last message_id is the one to reply to
          references: selectedEmail.message_id, // Simplified, might need full reference chain
          fromAddress: fromAddress
        }),
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Follow-up sent successfully!");
        setFollowUpDraft(''); // Clear draft
        setIsReplyModalOpen(false); // Close modal
        fetchCampaign(); // Refresh campaign data
      } else {
        throw new Error(data.error || "Failed to send follow-up.");
      }

    } catch (err: any) {
      console.error("Error sending follow-up:", err);
      toast.error(`Failed to send follow-up: ${err.message}`);
    } finally {
      setIsSendingFollowUp(false);
    }
  };


  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's a CSV file
    if (!file.name.endsWith('.csv')) {
      setUploadError('Please upload a CSV file');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Extract emails from CSV (assuming first column or email column)
      const emails: string[] = [];
      for (let i = 1; i < lines.length; i++) { // Skip header row
        const columns = lines[i].split(',');
        const email = columns[0]?.trim(); // Assume first column is email
        if (email && email.includes('@')) {
          emails.push(email);
        }
      }

      if (emails.length === 0) {
        setUploadError('No valid email addresses found in the CSV file');
        return;
      }

      // Save leads to database
      const { data, error } = await supabase.functions.invoke('leads-manager', {
        method: 'POST',
        body: JSON.stringify({
          campaign_id: campaignId,
          emails: emails
        }),
      });

      if (error) throw error;

      if (data.success) {
        // Refresh leads from database
        await fetchLeads();
        toast.success(data.message);
      } else {
        throw new Error('Failed to save leads');
      }
      
      // Clear the file input
      event.target.value = '';

    } catch (err: any) {
      setUploadError('Failed to process CSV file: ' + err.message);
      toast.error('Failed to upload CSV file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewReply = (email: Email) => {
    setSelectedEmail(email);
    setIsReplyModalOpen(true);
  };

  const handleSaveTagging = async () => {
    if (!selectedEmail) return;

    try {
      setIsSavingTag(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('save-tagging', {
        body: JSON.stringify({
          email_id: selectedEmail.id,
          outcome_tag: outcomeTag,
          notes: notes,
        }),
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Tagging saved successfully!");
        setNotes('');
        setOutcomeTag('');
        setIsSavingTag(false);
      } else {
        throw new Error("Failed to save tagging");
      }

    } catch (err: any) {
      setError(err.message);
      toast.error("Failed to save tagging: " + err.message);
    } finally {
      setIsSavingTag(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <p>Loading campaign...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <p className="text-red-500">Error: {error}</p>
        <Button onClick={() => window.history.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container mx-auto p-8">
        <p>Campaign not found</p>
        <Button onClick={() => window.history.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      {/* Campaign Details */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{campaign.name}</CardTitle>
          <CardDescription>
            Created on {new Date(campaign.created_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-500">Goal</Label>
              <p className="mt-1">{campaign.goal}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Target Audience</Label>
              <p className="mt-1">{campaign.audience}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Management */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Manage Leads</CardTitle>
          <CardDescription>
            Upload a CSV file with email addresses or use our lead finder to discover new prospects.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CSV Upload Section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="csv-upload" className="text-base font-medium">
                Upload CSV File
              </Label>
              <p className="text-sm text-gray-500 mt-1">
                Upload a CSV file with email addresses. The first column should contain email addresses.
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                disabled={isUploading}
                className="max-w-sm"
              />
              {isUploading && (
                <span className="text-sm text-gray-500">Processing...</span>
              )}
            </div>

            {uploadError && (
              <p className="text-red-500 text-sm">{uploadError}</p>
            )}

            {isLoadingLeads && (
              <p className="text-sm text-gray-500">Loading leads...</p>
            )}

            {leads.length > 0 && (
              <div className="mt-4">
                <Label className="text-sm font-medium">Uploaded Leads ({leads.length})</Label>
                <div className="mt-2 max-h-32 overflow-y-auto border rounded-md p-2 bg-gray-50">
                  {leads.slice(0, 10).map((lead, index) => (
                    <div key={lead.id} className="text-sm text-gray-600 py-1 flex justify-between items-center">
                      <span>{lead.email}</span>
                      <span className="text-xs text-gray-400 capitalize">{lead.status}</span>
                    </div>
                  ))}
                  {leads.length > 10 && (
                    <div className="text-sm text-gray-500 py-1">
                      ... and {leads.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Find Leads Section (Coming Soon) */}
          <div className="border-t pt-6">
            <div>
              <Label className="text-base font-medium">
                Find Me Leads (Coming Soon)
              </Label>
              <p className="text-sm text-gray-500 mt-1">
                Automatically discover and find qualified leads based on your target audience.
              </p>
            </div>
            
            <Button 
              variant="outline" 
              disabled 
              className="mt-4"
            >
              Find Leads
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sent Emails List */}
      {campaign.emails && campaign.emails.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Sent Emails</CardTitle>
            <CardDescription>
              A log of all emails sent for this campaign.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaign.emails.map((email) => (
                  <TableRow 
                    key={email.id}
                    onClick={() => {
                      if (email.status === 'replied' && email.replies.length > 0) {
                        handleViewReply(email);
                      }
                    }}
                    className={email.status === 'replied' ? 'cursor-pointer hover:bg-gray-50' : ''}
                  >
                    <TableCell>{email.recipient_email}</TableCell>
                    <TableCell>{email.subject}</TableCell>
                    <TableCell>{new Date(email.sent_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          email.status === 'replied'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {email.status === 'replied' ? 'Replied' : 'Sent'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Reply Details Modal */}
      <Dialog open={isReplyModalOpen} onOpenChange={setIsReplyModalOpen}>
        <DialogContent className="max-w-4xl h-5/6 flex flex-col">
          <DialogHeader>
            <DialogTitle>Reply from: {selectedEmail?.replies[0]?.from_address}</DialogTitle>
            <DialogDescription>
              Viewing reply for email sent to {selectedEmail?.recipient_email}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto p-4 space-y-6">
            {/* Reply Content */}
            <div className="border p-4 rounded-md bg-gray-50">
              <h3 className="font-semibold mb-2">Reply:</h3>
              <p className="text-sm whitespace-pre-wrap">{selectedEmail?.replies[0]?.snippet || 'No snippet available.'}</p>
            </div>
            
            {/* Original Email */}
            <div className="border p-4 rounded-md">
              <h3 className="font-semibold mb-2">Your Original Email:</h3>
              <p className="text-sm whitespace-pre-wrap">{selectedEmail?.original_draft}</p>
            </div>
          </div>
          <DialogFooter className="sm:justify-between items-center mt-4">
            <div className="flex items-center space-x-2">
              <Button variant={outcomeTag === 'positive' ? 'default' : 'outline'} size="sm" onClick={() => setOutcomeTag('positive')}>✅ Positive</Button>
              <Button variant={outcomeTag === 'neutral' ? 'default' : 'outline'} size="sm" onClick={() => setOutcomeTag('neutral')}>🤔 Neutral</Button>
              <Button variant={outcomeTag === 'negative' ? 'default' : 'outline'} size="sm" onClick={() => setOutcomeTag('negative')}>❌ Not interested</Button>
            </div>
            <Button onClick={handleSaveTagging} disabled={isSavingTag}>
              {isSavingTag ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>

          <div className="mt-6 border-t pt-4">
              <h4 className="font-semibold mb-2">Generate Follow-up</h4>
              <Button onClick={handleGenerateFollowUp} disabled={isGeneratingFollowUp}>
                  {isGeneratingFollowUp ? 'Generating...' : 'Generate Follow-up Idea'}
              </Button>
              {followUpDraft && (
                  <div className="mt-4">
                      <Label htmlFor="follow-up-draft">Generated Draft:</Label>
                      <Textarea
                          id="follow-up-draft"
                          value={followUpDraft}
                          readOnly
                          className="mt-2 h-48 bg-gray-50"
                      />
                      <Button 
                        onClick={handleSendFollowUp} 
                        disabled={isSendingFollowUp}
                        className="mt-2"
                      >
                        {isSendingFollowUp ? 'Sending...' : 'Send Follow-up'}
                      </Button>
                  </div>
              )}
          </div>

        </DialogContent>
      </Dialog>

      {/* Email Composer */}
      <Card>
        <CardHeader>
          <CardTitle>Compose Email</CardTitle>
          <CardDescription>
            Create a compelling cold email for your campaign. Use AI to generate a draft or write your own.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recipient Email */}
          <div>
            <Label htmlFor="recipient">Recipient Email</Label>
            <Input
              id="recipient"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="Enter recipient email address..."
              className="mt-1"
            />
          </div>

          {/* Subject Line */}
          <div>
            <Label htmlFor="subject">Subject Line</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              className="mt-1"
            />
          </div>

          {/* Email Body */}
          <div>
            <Label htmlFor="body">Email Body</Label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email content here..."
              className="mt-1 w-full min-h-[200px] p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button 
              onClick={handleGenerateEmail} 
              disabled={isGenerating}
              variant="outline"
            >
              {isGenerating ? "Generating..." : "Generate with AI"}
            </Button>
            
            <Button 
              onClick={handleSendEmail}
              disabled={!recipientEmail.trim() || !subject.trim() || !body.trim() || isSending}
            >
              {isSending ? "Sending..." : "Send Email"}
            </Button>
          </div>

          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 