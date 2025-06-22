-- Create the emails table
CREATE TABLE emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    -- 'draft', 'sent', 'replied', 'bounced'
    sent_at TIMESTAMP WITH TIME ZONE,
    thread_id TEXT,
    message_id TEXT,
    original_draft JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
-- Enable Row Level Security
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
-- Create RLS policy for user access
CREATE POLICY "Allow full access to own emails" ON emails FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Create indexes for better query performance
CREATE INDEX idx_emails_user_id ON emails(user_id);
CREATE INDEX idx_emails_campaign_id ON emails(campaign_id);
CREATE INDEX idx_emails_status ON emails(status);
CREATE INDEX idx_emails_sent_at ON emails(sent_at);