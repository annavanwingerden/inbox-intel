-- Add columns for tagging outcomes and adding notes to the replies table
ALTER TABLE replies
ADD COLUMN outcome_tag TEXT,
    ADD COLUMN notes TEXT;