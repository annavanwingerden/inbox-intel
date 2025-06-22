-- Create the user_tokens table for storing Gmail OAuth tokens
CREATE TABLE user_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    encrypted_refresh_token TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
-- Enable Row Level Security
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
-- Create RLS policy for user access
CREATE POLICY "Allow full access to own tokens" ON user_tokens FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Create indexes for better query performance
CREATE INDEX idx_user_tokens_user_id ON user_tokens(user_id);