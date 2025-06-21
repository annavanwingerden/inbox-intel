-- Create the replies table to store incoming email replies
CREATE TABLE replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
    user_id UUID,
    campaign_id UUID,
    message_id TEXT,
    -- The Gmail message ID of the reply
    thread_id TEXT,
    snippet TEXT,
    body TEXT,
    from_address TEXT,
    received_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
-- Enable Row Level Security
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
-- Create RLS policy for user access
CREATE POLICY "Allow full access to own replies" ON replies FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Create indexes for better query performance
CREATE INDEX idx_replies_email_id ON replies(email_id);
CREATE INDEX idx_replies_user_id ON replies(user_id);
CREATE INDEX idx_replies_campaign_id ON replies(campaign_id);