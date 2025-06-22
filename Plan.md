# InboxIntel - Implementation Plan

## 1. Introduction

This document provides a detailed, step-by-step implementation plan for building the InboxIntel application. It is designed to be executed by a code-generation LLM.

The plan is broken down into a series of atomic prompts. Each prompt represents one hour of development work, is self-contained, and builds directly upon the previous steps. This ensures a smooth, incremental, and error-minimized development process.

## 2. Phase 1: Project Foundation & Authentication

This phase sets up the core infrastructure of the Next.js application, integrates Supabase for backend services, and implements user authentication via Google.

### Prompt 1.1: Initialize Next.js Project

```text
Initialize a new Next.js project named "inbox-intel" using `create-next-app`. Configure it with TypeScript, Tailwind CSS, and the App Router. Also, initialize a new Git repository for the project.
```

### Prompt 1.2: Set Up UI Components with Shadcn UI

```text
Now, integrate Shadcn UI into the "inbox-intel" project. Initialize it and then add the following components that we will need later: `Button`, `Card`, `Input`, `Label`, `Dialog`, `Table`, and `Toast`.
```

### Prompt 1.3: Configure Supabase Client

```text
Create a utility file to initialize the Supabase client for client-side interactions. Create a `.env.local` file and add placeholders for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Update the `.gitignore` file to include `.env.local`.
```

### Prompt 1.4: Create the Login Page

```text
Create a login page at `/login`. This page should use the Supabase Auth UI package to render a pre-built "Sign in with Google" component. Add basic styling to center the login form on the page.
```

### Prompt 1.5: Implement Protected Routes and a Sign-Out Flow

```text
Create a middleware file (`middleware.ts`) to protect all routes except `/login`. If an unauthenticated user tries to access a protected route, they should be redirected to the `/login` page. Create a basic home page (`/`) that displays the user's email and a "Sign Out" button. The Sign Out button should call the Supabase `signOut` function and redirect the user back to the login page.
```

## 2. Phase 2: Database Schema and Security

This phase establishes the database structure and security rules using a hybrid approach of local setup and conversational deployment.

### Prompt 2.1: Initialize Supabase and Create `campaigns` Table

```text
First, initialize Supabase for local development by running `supabase init`. Then, to create the `campaigns` table, use the `aci-mcp-unified` server with the following conversational approach:

1.  Start the conversation with the AI assistant by providing the standard context prompt for using MCP functions.
2.  Instruct the assistant to execute the `SUPABASE__RUN_SQL_QUERY` function with the following SQL query as the argument:
    `"CREATE TABLE campaigns (id UUID PRIMARY KEY, user_id UUID, name TEXT, goal TEXT, audience TEXT, created_at TIMESTAMP DEFAULT now());"`
```

### Prompt 2.2: Create `emails` and `replies` Tables

```text
To create the `emails` and `replies` tables, instruct the MCP server assistant to execute the `SUPABASE__RUN_SQL_QUERY` function with the following SQL as the argument:

`"CREATE TABLE emails (id UUID PRIMARY KEY, campaign_id UUID REFERENCES campaigns(id), user_id UUID, recipient_email TEXT, subject TEXT, original_draft TEXT, optimized_content TEXT, message_id TEXT, thread_id TEXT, status TEXT DEFAULT 'sent', sent_at TIMESTAMP DEFAULT now(), created_at TIMESTAMP DEFAULT now(), updated_at TIMESTAMP DEFAULT now()); CREATE TABLE replies (id UUID PRIMARY KEY, email_id UUID REFERENCES emails(id), user_id UUID, thread_id TEXT, in_reply_to_message_id TEXT, content TEXT, received_at TIMESTAMP DEFAULT now(), outcome_tag TEXT, notes TEXT, created_at TIMESTAMP DEFAULT now());"`
```

### Prompt 2.3: Implement Row Level Security (RLS) Policies

```text
To enable Row Level Security and create the necessary security policies, instruct the MCP server assistant to execute the `SUPABASE__RUN_SQL_QUERY` function with the following SQL as the argument:

`"ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY; CREATE POLICY \"Allow full access to own campaigns\" ON campaigns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); ALTER TABLE emails ENABLE ROW LEVEL SECURITY; CREATE POLICY \"Allow full access to own emails\" ON emails FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); ALTER TABLE replies ENABLE ROW LEVEL SECURITY; CREATE POLICY \"Allow full access to own replies\" ON replies FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);"`
```

## 3. Phase 3: Campaign Management (Backend & Frontend)

This phase builds the core functionality for managing campaigns, starting with the backend Edge Function and then creating the frontend UI to interact with it.

### Prompt 3.1: Create a Supabase Edge Function for Campaigns

```text
Using the Supabase CLI, create a new Edge Function named `campaign-manager`. The function should handle CORS and parse the user's authentication token. Create a main router that handles different HTTP methods (`GET`, `POST`, `DELETE`). For now, these handlers can return simple placeholder responses.
```

### Prompt 3.2: Implement `GET` and `POST` Logic for Campaigns

```text
In the `campaign-manager` Edge Function, implement the logic for the `GET` and `POST` handlers. The `GET` handler should query the `campaigns` table and return a list of all campaigns belonging to the authenticated user. The `POST` handler should accept a new campaign's data (`name`, `goal`, `audience`) from the request body, insert it into the `campaigns` table, and return the newly created campaign.
```

### Prompt 3.3: Build the Campaign Dashboard UI

```text
Create a new page at `/dashboard`. This page will be the main campaign dashboard. On this page, fetch and display the user's campaigns by calling the `campaign-manager` Edge Function from a client component. Display the campaigns in a `Table` (using Shadcn UI). The table should have columns for Name, Goal, and Audience. Include a "Create Campaign" button on this page.
```

### Prompt 3.4: Build the "Create Campaign" Form

```text
When the "Create Campaign" button is clicked, open a `Dialog` modal containing a form with `Input` fields for the campaign's name, goal, and audience. When the form is submitted, invoke the `POST` endpoint of the `campaign-manager` Edge Function with the form data. Upon successful creation, close the modal and refresh the campaign list on the dashboard.
```

## 3.5 Phase 3.5: Authentication Flow Migration & Correction

This is a critical, unplanned phase to correct the authentication flow after Supabase deprecated the `@supabase/auth-helpers-nextjs` package in favor of `@supabase/ssr`. This also includes fixes for CORS and database permissions discovered during testing.

### Prompt 3.5.1: Migrate to `@supabase/ssr`

```text
The `@supabase/auth-helpers-nextjs` package is deprecated. First, uninstall it and install the new required packages: `npm uninstall @supabase/auth-helpers-nextjs && npm install @supabase/ssr @supabase/auth-ui-react @supabase/auth-ui-shared`. Then, update the core authentication files.
1.  **Client (`src/lib/supabaseClient.ts`):** Replace the contents with a new factory function: `import { createBrowserClient } from '@supabase/ssr'; export const createSupabaseClient = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)`.
2.  **Middleware (`src/middleware.ts`):** Replace the entire file with the new standard middleware provided in the Supabase `ssr` documentation. This is crucial for session management.
3.  **Callback Route (`src/app/auth/callback/route.ts`):** Create this new route to handle the server-side logic after a Google login. It must use `createServerClient` from `@supabase/ssr` and correctly handle cookie exchange before redirecting to the dashboard.
```

### Prompt 3.5.2: Update Pages to Use New Supabase Client

```text
The Supabase client is no longer a direct export; it's now created by a function. Update all pages that use the client to call `createSupabaseClient()` at the top of the component.
- `src/app/login/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/page.tsx`
```

### Prompt 3.5.3: Fix CORS and Deploy Edge Function

```text
Browser security will block requests from the web app to the Supabase Edge Function without the correct CORS headers.
1.  **Update Edge Function (`supabase/functions/campaign-manager/index.ts`):** Add a CORS headers object and an 'OPTIONS' preflight request handler. Ensure every `Response` object returned from the function includes these CORS headers.
2.  **Log into Supabase CLI:** The CLI is required to deploy functions. Run `npx supabase login` and provide a Personal Access Token generated from your Supabase dashboard.
3.  **Deploy the function:** Run `npx supabase functions deploy campaign-manager --project-ref <your-project-ref>`.
```

### Prompt 3.5.4: Secure the `user_tokens` Table

```text
The `user_tokens` table needs Row Level Security (RLS) policies to allow users to securely access their own data. Without this, the database will return `406 Not Acceptable` errors. Use the `SUPABASE__RUN_SQL_QUERY` function via the `aci-mcp-unified` server to execute the following SQL:
`"ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY; CREATE POLICY \"Allow individual access to own tokens\" ON public.user_tokens FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);"`
```

### Prompt 3.5.5: Fix Missing Dependencies Issue

```text
If the application fails to start with errors related to missing `@supabase/auth-ui-react` or other Supabase packages, this indicates a dependency installation issue. To resolve this:

1.  **Verify package.json:** Check that all required Supabase packages are listed in `package.json` dependencies:
    - `@supabase/ssr`
    - `@supabase/auth-ui-react` 
    - `@supabase/auth-ui-shared`
    - `@supabase/supabase-js`

2.  **Clean and reinstall:** Run `npm ci` to perform a clean install of all dependencies, or alternatively:
    - Delete `node_modules` folder and `package-lock.json`
    - Run `npm install` to reinstall all dependencies fresh

3.  **Verify installation:** After reinstallation, confirm the packages are properly installed by checking `node_modules/@supabase/` directory exists and contains the expected packages.

This fix addresses dependency resolution issues that can occur when packages are listed in package.json but not properly installed in node_modules.
```

### Prompt 3.5.5: Fix Gmail Connection Edge Functions

```text
The Gmail connection functionality requires two Edge Functions that were deleted and need to be recreated:

1.  **Recreate `gmail-auth-start` function:** Create `supabase/functions/gmail-auth-start/index.ts` with:
    - CORS headers configuration
    - Google OAuth2 URL generation with proper scopes (`gmail.send`, `gmail.readonly`)
    - Proper redirect URI handling
    - Error handling for missing environment variables

2.  **Recreate `gmail-auth-token` function:** Create `supabase/functions/gmail-auth-token/index.ts` with:
    - CORS headers configuration
    - Authorization code exchange with Google OAuth2
    - Secure token storage in the `user_tokens` table
    - Proper error handling and response formatting

3.  **Deploy both functions:** Use `npx supabase functions deploy gmail-auth-start --project-ref <project-ref>` and `npx supabase functions deploy gmail-auth-token --project-ref <project-ref>` to deploy the functions to Supabase.

This fix restores the Gmail OAuth flow that allows users to connect their Gmail accounts to the application for sending emails.
```

## 4. Phase 4: Gmail API Integration & OAuth

This phase covers the critical user-facing flow for connecting a user's Gmail account to our application.

### Prompt 4.1: Create UI for Connecting to Gmail

```text
On the main dashboard page, add a "Connect your Gmail Account" button or banner that is visible only if the user has not yet connected their account. When clicked, this button should initiate the OAuth flow by calling a new Edge Function.
```

### Prompt 4.2: Create Edge Function for OAuth Redirect

```text
Create a new Supabase Edge Function named `gmail-auth-start`. This function will generate the Google OAuth2 consent screen URL, including the necessary scopes (`gmail.send`, `gmail.readonly`) and a `redirect_uri` pointing to a callback page in our app. It should return this URL to the frontend, which will then redirect the user.
```

### Prompt 4.3: Implement the OAuth Callback Page

```text
Create a new page in the Next.js app at `/auth/callback/google`. This page will receive the authorization `code` from Google after the user grants consent. The page should immediately take this code and invoke another Edge Function to complete the token exchange process.
```

### Prompt 4.4: Create Edge Function for Token Exchange & Storage

```text
Create a new Supabase Edge Function named `gmail-auth-token`. This function will receive the authorization `code` from the callback page. It will then make a server-to-server request to Google's servers to exchange the code for an `access_token` and a `refresh_token`. You must encrypt the refresh token before securely storing both tokens in a new database table, `user_tokens`, associated with the `user_id`.
```

## 5. Phase 5: Email Authoring & Sending

This phase focuses on the email workflow, from using AI to help write the email to sending it via the Gmail API.

### Prompt 5.1: Create the "Generate Email" Edge Function

```text
Create a new Supabase Edge Function named `generate-email-draft`. This function will take a campaign goal and audience description as input. It will then call the OpenAI API (using the GPT-4 model) with a carefully crafted prompt to generate a cold email draft. **Crucially, integrate the Comet Opik SDK into this function. Log the prompt, the model parameters, and the final generated email to Comet Opik for evaluation and tracking.** The function should return the generated email content as a JSON response. Remember to handle API keys as environment variables.
```

### Prompt 5.2: Build the Email Composer UI

```text
Create a new page at `/campaigns/[id]`. This will be the detail view for a single campaign. On this page, display the campaign details. Add a section for composing an email, including a `TextArea` for the email body and an `Input` for the subject. Add a "Generate with AI" button. When clicked, this button should call the `generate-email-draft` function and populate the textarea with the response.
```

### Prompt 5.3: Create the "Send Email" Edge Function

```text
Create a new Supabase Edge Function named `send-email`. This function will now retrieve the user's stored OAuth tokens from the `user_tokens` table. It should accept a recipient email, subject, and body. It will then use the Gmail API (`users.messages.send`) to send the email. After sending, it should save the `messageId` and `threadId` to our `emails` table.
```

### Prompt 5.4: Wire Up the "Send Email" UI

```text
On the campaign detail page (`/campaigns/[id]`), add an `Input` for the recipient's email address and a "Send Email" button. When clicked, this button should invoke the `send-email` Edge Function with the recipient, subject, and email body. Show a `Toast` notification to the user indicating whether the send was successful or failed.
```

## 5.5 Phase 5.5: Leads Management & Persistence

This phase adds persistent lead management to campaigns, allowing users to upload CSVs of leads and ensuring leads are always available for each campaign.

### Prompt 5.5.1: Create the `leads` Table

```text
Create a new `leads` table in the Supabase database with the following columns:
- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE
- user_id UUID
- email TEXT NOT NULL
- first_name TEXT (optional)
- last_name TEXT (optional)
- company TEXT (optional)
- status TEXT DEFAULT 'pending'
- created_at TIMESTAMP DEFAULT now()
- updated_at TIMESTAMP DEFAULT now()

Enable Row Level Security (RLS) and add a policy to allow users to access only their own leads.
```

### Prompt 5.5.2: Create the `leads-manager` Edge Function

```text
Create a new Supabase Edge Function named `leads-manager` to handle:
- GET: Fetch all leads for a given campaign and user
- POST: Bulk insert leads (from CSV upload) for a campaign
- DELETE: Remove a lead by id
Ensure all requests are authenticated and CORS is handled.
```

### Prompt 5.5.3: Update Campaign Detail Page for Lead Upload & Display

```text
On the `/campaigns/[id]` page, add a section for managing leads:
- Allow users to upload a CSV file of leads (emails)
- On upload, call the `leads-manager` Edge Function to save leads to the database
- Display a preview of uploaded leads (with status)
- Always fetch and display leads from the database when the page loads
- Add a placeholder UI for the "Find Me Leads" feature (button, description, disabled)
```

### Prompt 5.5.4: Ensure Leads Persistence

```text
Test that leads persist across page reloads, logouts, and logins. Confirm that leads are always loaded from the database and not just stored in local state.
```

## 6. Phase 6: Automated Reply Tracking

This phase implements the automated background process to check for and ingest replies to sent emails.

### Prompt 6.1: Create a Scheduled Edge Function for Reply Polling

```text
Using the Supabase CLI, create a new Edge Function named `reply-poller`. Using `pg_cron`, create a new database migration to schedule this function to run every 10 minutes. For now, the function should simply log a "Polling for replies..." message.
```

### Prompt 6.2: Implement Gmail Polling Logic

```text
In the `reply-poller` Edge Function, implement the core logic. The function should first query your database for all emails that have a `status` of 'sent'. Then, for each of these emails, it will need to use its `threadId` to query the Gmail API (`users.threads.get`) to check for new messages in the thread. For now, mock the Gmail API call and focus on iterating through the correct emails.
```

### Prompt 6.3: Process Replies and Update the Database

```text
Now, complete the `reply-poller` logic. When a new message is found in a thread (and it's not from the original sender), your function should do two things: 1) Update the status of the original message in your `emails` table to 'replied'. 2) Insert the content of the new reply message into the `replies` table, making sure to link it to the correct `email_id`.
```

### Prompt 6.4: Display Reply Status in the UI

```text
On the campaign detail page (`/campaigns/[id]`), create a list or table of all emails sent for that campaign. This list should include the recipient, the subject, and a "Status" column that dynamically displays 'Sent', 'Replied', or 'No Response' based on the data fetched from the `emails` table.
```

## 7. Phase 7: Outcome Tagging & Follow-ups

This phase allows users to manually triage their replies and send context-aware follow-up emails.

### Prompt 7.1: Create UI for Viewing and Tagging Replies

```text
In the email list on the campaign detail page, make each row for a 'Replied' email clickable. Clicking it should open a `Dialog` modal that displays the full thread content (the original email and the reply). Inside this modal, add buttons for tagging the outcome: '✅ Positive', '❌ Not interested', '🤔 Maybe later', and a `TextArea` for free-text notes.
```

### Prompt 7.2: Create Edge Function to Save Outcome Tags

```text
Create a new Supabase Edge Function named `tag-reply`. This function should accept an `email_id`, an `outcome_tag`, and `notes` in its payload. It will then find the corresponding record in the `replies` table and update it with the provided tag and notes.
```

### Prompt 7.3: Implement Follow-up Email Generation

```text
In the reply `Dialog`, add a "Generate Follow-up" button. When clicked, this should call the `generate-email-draft` function. This time, however, you will enhance the prompt you send to OpenAI, providing not just the original goal, but also the full context of the email thread and the user's notes to generate a relevant follow-up draft. Display the generated draft in a new `TextArea` within the dialog.
```

### Prompt 7.4: Implement "Send Follow-up" Logic

```text
Add a "Send Follow-up" button to the reply dialog. This button will invoke the `send-email` function. You must modify the `send-email` function so that if a `threadId` is passed along with the recipient, subject, and body, it sends the new email as a reply within that existing thread, rather than creating a new one.
```

## 8. Phase 8: Analytics Dashboard

This final phase for the MVP creates a simple dashboard to view key campaign performance metrics.

### Prompt 8.1: Create Edge Function for Campaign Analytics

```text
Create a new Supabase Edge Function named `get-campaign-analytics`. This function will accept a `campaign_id`. It should query the `emails` and `replies` tables to calculate and return a JSON object with the following stats: total emails sent, total replies received, reply rate (%), and a count for each outcome tag ('positive', 'not_interested', etc.).
```

### Prompt 8.2: Build the Analytics UI

```text
On the campaign detail page (`/campaigns/[id]`), add an "Analytics" tab. When this tab is active, it should call the `get-campaign-analytics` function. Display the returned stats using a series of `Card` components, providing a clear and simple overview of the campaign's performance.
```

## 9. Phase 9: Hybrid Deployment (aci-mcp-unified & Supabase CLI)

This phase covers deploying the application using the specified hybrid approach.

### Prompt 9.1: Deploy Frontend via Conversational AI

```text
To deploy the frontend, you will need to run npm build and fix any errors. Then you will need to use the 
Then Run npm build and fix errors.

Then you should: `aci-mcp-unified` server. Start the conversation with the MCP server that is connected to Cursor.

Check if there is a Github repo already. If there is, then use this and push the code. Otherwise create a Github repo and push the code.

Deploy to Vercel and send annaencodehack@gmail.com the final URL via gmail.
```

### Prompt 9.2: Deploy Edge Functions via Supabase CLI

```text
After the MCP server confirms the frontend deployment is complete, deploy all the Edge Functions from your local machine using the Supabase CLI. This is a manual step required because the server does not have this capability. The command is:

`supabase functions deploy --project-ref <your-project-ref>`
```

### Prompt 9.3: Final Production Check and Documentation

```text
Once both deployment steps are complete, manually verify that the Vercel application is live and that the Supabase functions are available. Then, create or update the `README.md` file. Document the high-level architecture, local setup, and **the specific hybrid deployment process**: using the conversational AI for frontend/database changes and the Supabase CLI for Edge Functions.
```

This completes the full, detailed implementation plan. 