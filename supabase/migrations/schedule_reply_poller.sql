-- Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Grant usage to the postgres user
GRANT USAGE ON SCHEMA cron TO postgres;
-- Schedule the reply-poller function to run every 10 minutes
-- The function is invoked via an HTTP POST request.
-- Make sure to replace YOUR_PROJECT_REF and YOUR_SUPABASE_ANON_KEY with your actual credentials.
-- Note: It's generally safer to store the anon key as a secret. For this implementation, we place it here for simplicity.
SELECT cron.schedule(
        'poll-email-replies',
        -- The name of the cron job
        '*/10 * * * *',
        -- The schedule (every 10 minutes)
        $$
        SELECT net.http_post(
                url := 'https://nenjfajozamzaqgvpbmd.supabase.co/functions/v1/reply-poller',
                headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lbmpmYWpvemFtemFxZ3ZwYm1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0OTgzOTYsImV4cCI6MjA2NjA3NDM5Nn0._qHmM3vwTYTEo0Argfj34pbnBVVTgcCJoXcaMUbR9I8"}'::jsonb,
                body := '{}'::jsonb
            );
$$
);